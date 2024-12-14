#!/usr/bin/env node
"use strict";
const {program} = require('commander')
const {generateProjectStructure} = require("./install.js")

const bootstrap = async () => {
    program
        .version(require('../package.json').version, '-v, --version', 'Output the current version.')
        .description('CLI pour installer et configurer le framework mult')
        .command('new <project-name>')
        .description('Installer le framework dans un nouveau projet')
        .action((projectName) => {
            generateProjectStructure(projectName).catch(err => {
                console.error(err);
            })
        });

    await program.parse(process.argv);
}
bootstrap();
