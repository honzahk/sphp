import {execSync} from "child_process";
(console.log as any).error = (...args) => console.log("\x1b[31m%s\x1b[0m", ...args);
(console.log as any).ok = (...args) => console.log("\x1b[36m%s\x1b[0m", ...args);

const checkSudo = () => {
	const sudo_euid = 0;
	const euid = process.geteuid();
	if (euid != sudo_euid) {
		console.log("Re-run with sudo, please.");
		process.exit(1);
	}
};

const checkArgs = () => {
	if (process.argv.length != 3) {
		console.log("Usage: sphp X.Y");
		process.exit(1);
	}
};

const printUnsupportedVersion = (target, installed) => {
	(console.log as any).error(`Unsupported version!`);
	console.log(`CLI versions installed: ${installed.cli.join(" , ")}`);
	console.log(`A2  versions installed: ${installed.a2.join(" , ")}`);
};

const getPhpVersionsInstalled = () => {
	const cmd_php_installed = `dpkg --get-selections | grep -i php`;
	const out_php_installed = execSync(cmd_php_installed).toString();

	const phpCliRegex = /^php\d\.\d\t+install$/gm;
	const phpA2Regex = /^libapache2-mod-php\d\.\d\t+install$/gm;

	const versions = {
		cli: out_php_installed.match(phpCliRegex).map((match) => match.substr(3, 3)),
		a2: out_php_installed.match(phpA2Regex).map((match) => match.substr(18, 3))
	};

	return versions;
};

const switchPhpCLI = (phpTarget) => {
	console.log("Switching CLI version..");
	execSync(`sudo update-alternatives --set php /usr/bin/php${phpTarget}`);
};

const switchPhpA2 = (phpTarget) => {
	console.log("Switching A2 version..");
	const cmd_php_enabled = `sudo a2query -m`;
	const out_php_enabled = execSync(cmd_php_enabled).toString();

	const phpEnabledRegex = /^php\d\.\d/gm;

	const phpEnabledVersions = out_php_enabled.match(phpEnabledRegex) || [];
	const cmd_a2_disable_php_versions = phpEnabledVersions.map((v) => `sudo a2dismod ${v} && `).join("");

	execSync(`${cmd_a2_disable_php_versions} sudo a2enmod php${phpTarget} && sudo service apache2 restart`);
};

const main = () => {
	checkSudo();
	checkArgs();

	const phpTarget = process.argv[2];
	const phpInstalled = getPhpVersionsInstalled();

	if (!phpInstalled.cli.includes(phpTarget) || !phpInstalled.a2.includes(phpTarget)) {
		printUnsupportedVersion(phpTarget, phpInstalled);
		return;
	}

	switchPhpCLI(phpTarget);
	switchPhpA2(phpTarget);
	(console.log as any).ok("Done!");
};

main();
