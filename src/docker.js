"use strict";
const exec = require("shelljs").exec;
const pwd = require("shelljs").pwd;
const fs = require("fs");
const child_process = require("child_process");
const path = require('path');
const os = require('os');
const { strict } = require("assert");

const BUILD_SCRIPT = ".bbrun.sh";
const TMP_DIR = '.bbrun';

function deleteBuildScript() {
  if (fs.existsSync(BUILD_SCRIPT)) {
    fs.unlinkSync(BUILD_SCRIPT);
  }

  if (fs.existsSync(`./${TMP_DIR}`)) {
    deleteFolderSync(`./${TMP_DIR}`);
  }
}


function prepareBuildScript(commands) {
  deleteBuildScript();
  const script = "#!/usr/bin/env sh\n" + commands.join("\n");
  fs.writeFileSync(BUILD_SCRIPT, script);
}

function checkExists() {
  const dockerStatus = exec("docker -v", { silent: true });
  if (dockerStatus.code !== 0) {
    console.error(`
      Error: bbrun requires a valid Docker installation"
      Output:
          $ docker -v
          ${dockerStatus.stdout}`);
    process.exit(1);
  }
}

function run(commands, image, dryRun, interactive, workDir, ignoreFolder, cleanRun) {
  let ignore = '';
  if (typeof ignoreFolder !== "undefined") {
    if (typeof ignoreFolder === "string") {
      ignoreFolder = [ignoreFolder];
    }
    ignore = ignoreFolder.map((f) => {
      return `-v ${pwd()}/${TMP_DIR}/:${workDir}/${f}`;
    }).join(' ');
  }

  let cmd = interactive
    ? `run --rm -P -it --entrypoint=/bin/bash -v ${pwd()}:${workDir} -w ${workDir} ${image}`
    : `run --rm -P -v ${pwd()}:${workDir} -w ${workDir} ${image} bash ${BUILD_SCRIPT}`;

  if (cleanRun) cmd = `run --name bbrun -d -t -P ${image} /bin/bash -c "trap : TERM INT; sleep infinity & wait"`;

  if (dryRun) {
    console.log(`docker command:\n\tdocker ${cmd}`);
    console.log(`build script:\n\t${commands.join("\n\t")}`);
  } else if (interactive) {
    console.log(`opening shell for image "${image}, run "s"`);
    child_process.execFileSync("docker", cmd.split(" "), {
      stdio: "inherit"
    });
  } else {
    prepareBuildScript(commands);

    if (cleanRun) {
      // clean older docker
      exec(`docker rm -f bbrun`);

      // run new image
      exec(`docker ${cmd}`, { async: false });

      // build & copy & clean patch      
      exec(`git diff HEAD > patch.patch`, { async: false });
      exec(`docker cp  patch.patch bbrun:/`, { async: false });
      exec(`del patch.patch`, { async: false });

      exec(`docker cp  ${BUILD_SCRIPT} bbrun:/`, { async: false });
      exec(`docker exec bbrun bash ${BUILD_SCRIPT}`, { async: false });
      exec(`docker stop bbrun`);
      exec(`docker rm -f bbrun`);
    }
    else {
      exec(`docker ${cmd}`, { async: false });
    }
    deleteBuildScript();
  }
}

function extractImageName(image) {
  if (typeof image === "string" || image instanceof String) {
    return image;
  } else if (image.name) {
    return image.name;
  } else {
    throw new Error(`"${JSON.stringify(image)}" is not a valid image`);
  }
}

function deleteFolderSync(path) {
  var files = [];
  if (fs.existsSync(path)) {
    files = fs.readdirSync(path);
    files.forEach(function (file, index) {
      var curPath = path + "/" + file;
      if (fs.lstatSync(curPath).isDirectory()) { // recurse
        deleteFolderSync(curPath);
      } else { // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
}

module.exports.checkExists = checkExists;
module.exports.run = run;
module.exports.extractImageName = extractImageName;
