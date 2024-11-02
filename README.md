# Build a Cross-Platform CLI with Deno and Conditional Unstable API Use

<!-- TODO: Implement `deno run -A https://deno.land/x/@blefnk/deno-cli-tutorial@latest` -->

## Overview

Command line interfaces (CLIs) are powerful tools, often providing the fastest way to perform specific tasks. In this guide, we’ll create a Deno-based CLI called `greetme`, which:

- Greets the user with a randomly selected message,
- Accepts user inputs for name and color customization,
- Saves settings for future sessions.

This CLI is unique in that it **conditionally uses Deno's unstable Key-Value (KV) API** if the necessary flags are present, while **falling back to JSON-based storage** if they are not. This flexibility allows the CLI to run in both stable and unstable Deno environments.

### What You’ll Learn

1. Setting up and structuring a Deno CLI project.
2. Parsing command-line arguments.
3. Using Deno’s Key-Value (KV) store and falling back to JSON-based storage.
4. Implementing a friendly user experience with prompts.

## Getting Started

### 1. Project Structure

Create a project directory, `greetme-cli`, and add the following files:

- **`main.ts`**: CLI logic.
- **`greetings.json`**: Array of greetings for randomized outputs.
- **`settings.json`**: Storage file for user settings (automatically generated when not found, only used in the fallback to JSON).

**Folder structure:**

```bash
greetme/
├── main.ts
├── src/
│   └── data/
│       └── greetings.json
└── settings.json
```

### 2. Setting Up `greetings.json`

Create `src/data/greetings.json` and populate it with a list of greetings:

```json
[
  "Hello",
  "Howdy",
  "Ahoy",
  "Good day",
  "Hi there",
  "It's nice to see you",
  "Good to meet you"
]
```

Here’s an example of what `settings.json` might look like after running the CLI and saving a few name-color pairs:

```json
{
  "Nazar": "green",
  "Andy": "blue",
  "Blefnk": "red"
}
```

Each entry in this JSON file corresponds to a user’s name and their preferred greeting color. When the CLI runs, it reads this file to retrieve the color associated with a specified name, allowing for a personalized greeting experience.

### How `settings.json` is Updated

- If you run the CLI with `--save`, it will add or update the entry for the specified `name` with the given `color`.
- If no color is provided, it will prompt you and save the entered color.

### Example Commands to Generate `settings.json`

```shell
# This will ask and saves John's preferred color as green in the settings.json file
deno --allow-read --allow-write main.ts --name=John --save

# This will save Andy's preferred color as blue in the KV store
deno --unstable --unstable-kv --allow-read --allow-write main.ts --name=Andy --save

# Running with Blefnk will prompt for color if none is saved yet
deno --allow-read --allow-write main.ts --name=Blefnk --save
# Enter your favorite color: red
```

If you call those commands again, you'll see greetings with the saved colors.

These commands will update `settings.json` with each name-color pair, as shown in the example `main.ts` file.

## Implementing the CLI

### `main.ts`: The Core CLI Logic

This file includes:

1. **Argument parsing** using Deno's `flags` module.
2. **Conditional storage**: `Deno KV` store when unstable APIs are enabled, falling back to JSON otherwise.
3. **Interactive prompts** for the user when arguments aren’t provided.

Here's the `main.ts` code:

```typescript
import greetings from "./src/data/greetings.json" with { type: "json" };
import { parse } from "https://deno.land/std@0.181.0/flags/mod.ts";
import type { Args } from "https://deno.land/std@0.181.0/flags/mod.ts";

const SETTINGS_FILE = "./settings.json";

export function parseArguments(args: string[]): Args {
 const booleanArgs = ["help", "save"];
 const stringArgs = ["name", "color"];
 const alias = {
  help: "h",
  save: "s",
  name: "n",
  color: "c",
 };

 return parse(args, {
  alias,
  boolean: booleanArgs,
  string: stringArgs,
  stopEarly: false,
 });
}

function printHelp(): void {
 console.log("Usage: greetme [OPTIONS...]");
 console.log("\nOptional flags:");
 console.log("  -h, --help                Display this help and exit");
 console.log("  -s, --save                Save settings for future greetings");
 console.log("  -n, --name <name>         Set your name for the greeting");
 console.log("  -c, --color <color>       Set the color of the greeting");
}

async function loadSettingsWithKv(): Promise<Record<string, string>> {
 const kv = await Deno.openKv("./kv.db");
 const settings: Record<string, string> = {};
 for await (const entry of kv.list({ prefix: [] })) {
  settings[entry.key[0] as string] = entry.value as string;
 }
 return settings;
}

async function saveSettingWithKv(name: string, color: string): Promise<void> {
 const kv = await Deno.openKv("./kv.db");
 await kv.set([name], color);
}

async function loadSettingsWithJson(): Promise<Record<string, string>> {
 try {
  const data = await Deno.readTextFile(SETTINGS_FILE);
  return JSON.parse(data);
 } catch (error) {
  if (error instanceof Deno.errors.NotFound) {
   return {};
  }
  throw error;
 }
}

async function saveSettingWithJson(name: string, color: string): Promise<void> {
 const settings = await loadSettingsWithJson();
 settings[name] = color;
 await Deno.writeTextFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

async function main(inputArgs: string[]): Promise<void> {
 const args = parseArguments(inputArgs);
 if (args.help) {
  printHelp();
  Deno.exit(0);
 }

 let settings: Record<string, string> = {};
 let saveSetting: (name: string, color: string) => Promise<void>;

 try {
  // Attempt to load settings using Deno KV if unstable APIs are available
  settings = await loadSettingsWithKv();
  saveSetting = saveSettingWithKv;
 } catch {
  // Fallback to JSON if KV API is unavailable
  settings = await loadSettingsWithJson();
  saveSetting = saveSettingWithJson;
 }

 const name = args.name || prompt("Enter your name:");
 const color =
  args.color || settings[name] || prompt("Enter your favorite color:");

 if (args.save) {
  await saveSetting(name, color);
 }

 const greeting = greetings[Math.floor(Math.random() * greetings.length)];
 console.log(`%c${greeting}, ${name}!`, `color: ${color}; font-weight: bold`);
}

main(Deno.args);
```

### Code Breakdown

- **Argument Parsing**: `parseArguments` uses the `flags` module to handle command-line options. Supported options:
  - `--help` (`-h`): Displays help.
  - `--save` (`-s`): Saves current settings for future sessions.
  - `--name` (`-n`): Sets the user’s name.
  - `--color` (`-c`): Sets the greeting color.

- **Conditional Unstable API Usage**:
  - `loadSettingsWithKv` and `saveSettingWithKv` handle loading/saving settings using `Deno.openKv`.
  - If accessing the KV API fails (likely due to missing `--unstable`), `loadSettingsWithJson` and `saveSettingWithJson` fall back to using a JSON file (`settings.json`).

- **Interactive Prompts**: If the name or color isn’t provided as a command-line argument, the CLI prompts the user interactively.

## Running the CLI

### Examples

```shell
# 👉 deno main.ts ✨ > A (to grant permissions) ✨ Nazar ✨ green
# 👉 deno --allow-read --allow-write main.ts --name=John --save
# 👉 deno --unstable --unstable-kv --allow-read --allow-write main.ts --name=Nazar --save
```

#### 1. Running in Stable Mode

```shell
$ deno --allow-read --allow-write main.ts --name=Nazar --save
# Enter your favorite color: green
```

#### 2. Running with Unstable APIs

To use Deno’s Key-Value store, add the `--unstable` and `--unstable-kv` flags:

```shell
deno --unstable --unstable-kv --allow-read --allow-write main.ts --name=Nazar --save
```

#### 3. Running Without Arguments

This example uses both prompt-based inputs and saved values if present.

```shell
$ deno --allow-read --allow-write main.ts
# Enter your name: Andy
# Enter your favorite color: blue
```

#### 4. Displaying Help

```shell
deno main.ts --help
```

## Key Takeaways

### Flexibility with Conditional Unstable APIs

By using `try-catch` for feature detection, the CLI:

- Uses the Deno KV API when available (with the `--unstable` flag),
- Falls back to JSON storage in stable mode.

### Improved User Experience

With options for interactivity, users can input values directly in the command line or save settings for future sessions.

## Testing

Deno includes a test runner to validate functionality.

`test_main.ts`:

```typescript
import { assertEquals } from "https://deno.land/std@0.181.0/testing/asserts.ts";
import { parseArguments } from "./main.ts";

Deno.test("parseArguments should correctly parse CLI arguments", () => {
  const args = parseArguments(["--name", "Andy", "--color", "blue"]);
  assertEquals(args.name, "Andy");
  assertEquals(args.color, "blue");
});
```

Run the test:

```shell
$ deno test --allow-read --allow-write
running 1 test from ./main_test.ts
parseArguments should correctly parse CLI arguments ... ok
```

## Compiling and Distributing

Use `deno compile` to create a cross-platform binary:

```shell
deno compile --allow-read --allow-write --unstable main.ts --output greetme
```

You should now have a `greetme` binary. Run it:

```shell
$ ./greetme --name=Andy --color=blue --save
Hello, Andy!
```

### Additional Resources

Deno’s simplicity means this CLI required no third-party dependencies. For more complex CLIs, consider using modules like:

- **cliffy**: A type-safe framework
- **denomander**: Inspired by Commander.js
- **chalk**: Colorizes terminal output
- **dax**: Cross-platform shell tools

## Summary

This Deno CLI provides a simple but powerful example of cross-platform command-line functionality. By using feature detection, it ensures compatibility with both stable and unstable versions of Deno. Experiment with this setup, and consider adding more features, such as additional storage options, custom greeting formats, or extended configuration options.

This article was highly inspired by a similar one on [the Deno website](https://deno.com/blog/build-cross-platform-cli). Please refer to Deno's documentation to know more about everything.

For questions related to this article, feedback, or contributions, feel free to reach out me on [GitHub](https://github.com/blefnk/deno-cli-tutorial) or [Discord](https://discord.gg/Pb8uKbwpsJ)!
