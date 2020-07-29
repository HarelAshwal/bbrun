const docker = require("./docker");
const parse = require('parse-git-config');

const { parseVars } = require("./util");

function exec(script, image, flags) {
  const environmentVars = flags.env ? parseVars(flags.env) : [];

  let commands = [].concat(
    environmentVars.map(x => `export ${x}`),
    "set -e",
    script
  );

  // filter excluded commands 
  commands = commands.filter((cmd) => { return !flags.exclude.some(ex => cmd.startsWith(ex)) })

  if (flags.cleanRun) {
    let gitConfig = parse.sync();
    let url = gitConfig['remote "origin"'].url;

    preScriptCommands = [
      "git clone " + url,
      "cd imax-gui",
      "git apply patch.patch"];

    commands = preScriptCommands.concat(commands);
  }

  docker.run(commands, image, flags.dryRun, flags.interactive, flags.workDir, flags.ignoreFolder, flags.cleanRun);
}

module.exports.exec = exec;
