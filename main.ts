// 👉 deno main.ts --save ✨ > A ✨ Nazar ✨ green
// 👉 deno --allow-read --allow-write main.ts --name=John --save
// 👉 deno --unstable --unstable-kv --allow-read --allow-write main.ts --name=John --save

import greetings from "./greetings.json" with { type: "json" };
import { parse } from "@std/flags";
import type { Args } from "@std/flags";

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

	if (!args.save) {
		console.error("Please use one of the following examples:");
		console.log("👉 bun dev 👉 bun dev:kv");
		console.log("👉 deno main.ts --save ✨ > A ✨ Nazar ✨ green ✨ > A ");
		console.log(
			"👉 deno --allow-read --allow-write main.ts --name=John --save",
		);
		console.log(
			"👉 deno --unstable --unstable-kv --allow-read --allow-write main.ts --name=John --save",
		);
		Deno.exit(1);
	}

	let settings: Record<string, string> = {};
	let saveSetting: (name: string, color: string) => Promise<void>;

	try {
		settings = await loadSettingsWithKv();
		saveSetting = saveSettingWithKv;
	} catch {
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
