const sections = [
  ["Development", [
    ["pnpm setup", "Run the repository setup script"],
    ["pnpm dev", "Start the local development stack"],
    ["pnpm dev:web", "Start the web app"],
    ["pnpm dev:mobile", "Start Expo for the mobile app"],
    ["pnpm mobile", "Run the mobile helper script"],
    ["pnpm ios:simulator", "Run the iOS simulator helper"],
    ["pnpm ios:device", "Run the physical iOS device helper"],
    ["pnpm docker:up", "Start the Docker stack"],
    ["pnpm docker:stop", "Stop the Docker stack"],
  ]],
  ["Raspberry Pi", [
    ["pnpm pi:build [pi4|pi5]", "Build the next appliance image with the friendly wrapper"],
    ["pnpm pi:image <version|next> <pi4|pi5>", "Call the low-level image builder directly"],
    ["pnpm pi:validate-rootfs <rootfs>", "Validate a generated appliance root filesystem"],
    ["pnpm pi:test", "Run Raspberry Pi appliance tests"],
  ]],
  ["Release", [
    ["pnpm release:build [version|next]", "Build signed application release artifacts without publishing"],
    ["pnpm release:publish [version|next]", "Build, tag, push, create the GitHub Release, and upload release assets"],
    ["pnpm release:build:raw <version>", "Call the Python release builder directly"],
  ]],
  ["Quality", [
    ["pnpm build:web", "Build the web app"],
    ["pnpm typecheck", "Run TypeScript checks across the workspace"],
  ]],
];

console.log("WhereHouse developer commands\n");
for (const [title, commands] of sections) {
  console.log(`${title}:`);
  const width = Math.max(...commands.map(([command]) => command.length));
  for (const [command, description] of commands) {
    console.log(`  ${command.padEnd(width)}  ${description}`);
  }
  console.log("");
}

console.log("Use pnpm commands any time you need a reminder.");
