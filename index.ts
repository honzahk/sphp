import {execSync} from "child_process";
import chalk from "chalk";

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
		printHelp();
		process.exit(1);
	}
};

const printHelp = () => {
	let text = `Usage:\n`;
	text += `sphp X.Y           switch php to version X.Y\n`;
	text += `sphp --list        print versions available`;
	console.log(text);
};

type TVersionSupportMap = {[version: string]: {cli: boolean; a2: boolean}};

const printVersionList = (versionAvailableMap: TVersionSupportMap) => {
	const yesMark = chalk.green("yes");
	const noMark = chalk.red("no");

	let text = "";
	text += `${chalk.bold("version")}  ${chalk.bold("cli")}  ${chalk.bold("a2")}\n`;
	const versions = Object.keys(versionAvailableMap);
	versions.forEach((version, idx) => {
		text += `${version}      ${versionAvailableMap[version].cli ? yesMark : noMark}  ${versionAvailableMap[version].a2 ? yesMark : noMark}`;
		if (idx < versions.length - 1) {
			text += `\n`;
		}
	});

	console.log(text);
};

const printUnsupportedVersion = (targetVersion: string) => {
	let text = chalk.red(`error: unsupported version '${targetVersion}' (check with 'sphp --list')`);
	console.log(text);
};

const getPhpVersionsInstalled: () => TVersionSupportMap = () => {
	const cmd_php_installed = `dpkg --list | grep php`;
	const out_php_installed = execSync(cmd_php_installed).toString();

	const phpCliRegex = /^ii\s+php\d\.\d\s+/gm;
	const phpA2Regex = /^ii\s+libapache2-mod-php\d\.\d\s+/gm;

	const cliVersions = out_php_installed.match(phpCliRegex).map((match) => match.match(/\d\.\d/)[0]);
	const a2Versions = out_php_installed.match(phpA2Regex).map((match) => match.match(/\d\.\d/)[0]);

	//get array of all versions installed - both cli and a2 - concatenate and uniquize
	const allVersions = Array.from(new Set([...cliVersions, ...a2Versions]));

	//now build a map: keys are php versions, values are cli/a2 support flags
	const versionSupportMap = allVersions.reduce((acc, version) => {
		return {
			...acc,
			[version]: {
				cli: cliVersions.includes(version),
				a2: a2Versions.includes(version)
			}
		};
	}, {});

	return versionSupportMap;
};

const switchPhpCLI = (phpTarget) => {
	process.stdout.write(`switching CLI version.. `);
	execSync(`sudo update-alternatives --set php /usr/bin/php${phpTarget}`);
	process.stdout.write(`${chalk.green(`done`)}\n`);
};

const switchPhpA2 = (phpTarget) => {
	process.stdout.write(`switching A2 version.. `);
	const cmd_php_enabled = `sudo a2query -m`;
	const out_php_enabled = execSync(cmd_php_enabled).toString();

	const phpEnabledRegex = /^php\d\.\d/gm;

	const phpEnabledVersions = out_php_enabled.match(phpEnabledRegex) || [];
	const cmd_a2_disable_php_versions = phpEnabledVersions.map((v) => `sudo a2dismod ${v} && `).join("");

	execSync(`${cmd_a2_disable_php_versions} sudo a2enmod php${phpTarget} && sudo service apache2 restart`);
	process.stdout.write(`${chalk.green(`done`)}\n`);
};

const main = () => {
	//check prerequisities
	checkSudo();
	checkArgs();

	//get php versions available
	const phpInstalled = getPhpVersionsInstalled();

	if (process.argv[2] == "--list") {
		printVersionList(phpInstalled);
		process.exit(0);
	} else if (process.argv[2] == "--help") {
		printHelp();
		process.exit(0);
	} else if (process.argv[2].match(/\d\.\d/gm) == null) {
		printHelp();
		process.exit(0);
	}

	const phpTarget = process.argv[2];
	const phpTargetSupport = phpInstalled[phpTarget];

	if (phpTargetSupport == undefined || phpTargetSupport.cli == false || phpTargetSupport.a2 == false) {
		//version has to be supported by both, cli and a2
		printUnsupportedVersion(phpTarget);
		process.exit(1);
	}

	switchPhpCLI(phpTarget);
	switchPhpA2(phpTarget);
};

main();
