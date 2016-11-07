import * as ts from 'typescript';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as LiveServer from 'live-server';
import * as Shelljs from 'shelljs';

import { logger } from '../logger';
import { HtmlEngine } from './engines/html.engine';
import { MarkdownEngine } from './engines/markdown.engine';
import { FileEngine } from './engines/file.engine';
import { Configuration } from './configuration';
import { DependenciesEngine } from './engines/dependencies.engine';
import { NgdEngine } from './engines/ngd.engine';
import { Dependencies } from './compiler/dependencies';

let pkg = require('../package.json'),
    program = require('commander'),
    files = [],
    cwd = process.cwd(),
    $htmlengine = new HtmlEngine(),
    $fileengine = new FileEngine(),
    $configuration = new Configuration(),
    $markdownengine = new MarkdownEngine(),
    $ngdengine = new NgdEngine(),
    $dependenciesEngine,
    startTime = new Date();

export namespace Application {

    program
        .version(pkg.version)
        .option('-f, --file [file]', 'A tsconfig.json file')
        .option('-d, --output [folder]', 'Where to store the generated documentation (default: ./documentation)', `./documentation/`)
        .option('-b, --base [base]', 'Base reference of html tag', '/')
        .option('-n, --name [name]', 'Title documentation', `Application documentation`)
        .option('-o, --open', 'Open the generated documentation', false)
        .option('-t, --silent', 'In silent mode, log messages aren\'t logged in the console', false)
        .option('-s, --serve', 'Serve generated documentation (default http://localhost:8080/)', false)
        .option('-g, --hideGenerator', 'Do not print the Compodoc link at the bottom of the page', false)
        .parse(process.argv);

    let outputHelp = () => {
        program.outputHelp()
        process.exit(1);
    }

    if (program.silent) {
        logger.silent = false;
    }

    $configuration.mainData.documentationMainName = program.name; //default commander value

    $configuration.mainData.base = program.base;

    let processPackageJson = () => {
        logger.info('Searching package.json file');
        $fileengine.get('package.json').then((packageData) => {
            let parsedData = JSON.parse(packageData);
            if (typeof parsedData.name !== 'undefined') {
                $configuration.mainData.documentationMainName = parsedData.name;
            }
            if (typeof parsedData.description !== 'undefined') {
                $configuration.mainData.documentationMainDescription = parsedData.description;
            }
            logger.info('package.json file found');
            processMarkdown();
        }, (errorMessage) => {
            logger.error(errorMessage);
            logger.error('Continuing without package.json file');
            processMarkdown();
        });
    }

    let processMarkdown = () => {
        logger.info('Searching README.md file');
        $markdownengine.getReadmeFile().then((readmeData) => {
            $configuration.addPage({
                name: 'index',
                context: 'readme'
            });
            $configuration.addPage({
                name: 'overview',
                context: 'overview'
            });
            $configuration.mainData.readme = readmeData;
            logger.info('README.md file found');
            getDependenciesData();
        }, (errorMessage) => {
            logger.error(errorMessage);
            logger.error('Continuing without README.md file');
            $configuration.addPage({
                name: 'index',
                context: 'overview'
            });
            getDependenciesData();
        });
    }

    let getDependenciesData = () => {
        logger.info('Get dependencies data');

        let crawler = new Dependencies(
          files, {
            tsconfigDirectory: cwd
          }
        );

        let dependenciesData = crawler.getDependencies();

        $dependenciesEngine = new DependenciesEngine(dependenciesData);

        prepareModules();

        prepareComponents();

        prepareDirectives();
        prepareInjectables();
        prepareRoutes();

        preparePipes();

        processPages();
    }

    let prepareModules = () => {
        logger.info('Prepare modules');
        $configuration.mainData.modules = $dependenciesEngine.getModules();
        $configuration.addPage({
            name: 'modules',
            context: 'modules'
        });
        let i = 0,
            len = $configuration.mainData.modules.length;

        for(i; i<len; i++) {
            $configuration.addPage({
                path: 'modules',
                name: $configuration.mainData.modules[i].name,
                context: 'module',
                module: $configuration.mainData.modules[i]
            });
        }
    }

    let preparePipes = () => {
        logger.info('Prepare pipes');
        $configuration.mainData.pipes = $dependenciesEngine.getPipes();
        $configuration.addPage({
            name: 'pipes',
            context: 'pipes'
        });
        let i = 0,
            len = $configuration.mainData.pipes.length;

        for(i; i<len; i++) {
            $configuration.addPage({
                path: 'pipes',
                name: $configuration.mainData.pipes[i].name,
                context: 'pipe',
                pipe: $configuration.mainData.pipes[i]
            });
        }
    }

    let prepareComponents = () => {
        logger.info('Prepare components');
        $configuration.mainData.components = $dependenciesEngine.getComponents();
        $configuration.addPage({
            name: 'components',
            context: 'components'
        });

        let i = 0,
            len = $configuration.mainData.components.length;

        for(i; i<len; i++) {
            $configuration.addPage({
                path: 'components',
                name: $configuration.mainData.components[i].name,
                context: 'component',
                component: $configuration.mainData.components[i]
            });
        }
    }

    let prepareDirectives = () => {
        logger.info('Prepare directives');
        $configuration.mainData.directives = $dependenciesEngine.getDirectives();

        $configuration.addPage({
            name: 'directives',
            context: 'directives'
        });

        let i = 0,
            len = $configuration.mainData.directives.length;

        for(i; i<len; i++) {
            $configuration.addPage({
                path: 'directives',
                name: $configuration.mainData.directives[i].name,
                context: 'directive',
                directive: $configuration.mainData.directives[i]
            });
        }
    }

    let prepareInjectables = () => {
        logger.info('Prepare injectables');
        $configuration.mainData.injectables = $dependenciesEngine.getInjectables();

        $configuration.addPage({
            name: 'injectables',
            context: 'injectables'
        });

        let i = 0,
            len = $configuration.mainData.injectables.length;

        for(i; i<len; i++) {
            $configuration.addPage({
                path: 'injectables',
                name: $configuration.mainData.injectables[i].name,
                context: 'injectable',
                injectable: $configuration.mainData.injectables[i]
            });
        }
    }

    let prepareRoutes = () => {
        logger.info('Process routes');
        $configuration.mainData.routes = $dependenciesEngine.getRoutes();

        $configuration.addPage({
            name: 'routes',
            context: 'routes'
        });

        /*
        let i = 0,
            len = $configuration.mainData.injectables.length;

        for(i; i<len; i++) {
            $configuration.addPage({
                path: 'injectables',
                name: $configuration.mainData.injectables[i].name,
                context: 'injectable',
                injectable: $configuration.mainData.injectables[i]
            });
        }*/
    }

    let processPages = () => {
        logger.info('Process pages');
        let pages = $configuration.pages,
            i = 0,
            len = pages.length,
            loop = () => {
                if( i <= len-1) {
                    logger.info('Process page', pages[i].name);
                    $htmlengine.render($configuration.mainData, pages[i]).then((htmlData) => {
                        let path = program.output;
                        if (pages[i].path) {
                            path += '/' + pages[i].path + '/';
                        }
                        path += pages[i].name + '.html';
                        fs.outputFile(path, htmlData, function (err) {
                            if (err) {
                                logger.error('Error during ' + pages[i].name + ' page generation');
                            } else {
                                i++;
                                loop();
                            }
                        });
                    }, (errorMessage) => {
                        logger.error(errorMessage);
                    });
                } else {
                    processResources();
                }
            };
        loop();
    }

    let processResources = () => {
        logger.info('Copy main resources');
        fs.copy(path.resolve(__dirname + '/../src/resources/'), path.resolve(process.cwd() + path.sep + program.output), function (err) {
            if (err) {
                logger.error('Error during resources copy');
            } else {
                processGraphs();
            }
        });
    }

    let processGraphs = () => {
        logger.info('Process main graph');
        let modules = $configuration.mainData.modules,
            i = 0,
            len = modules.length,
            loop = () => {
                if( i <= len-1) {
                    logger.info('Process module graph', modules[i].name);
                    $ngdengine.renderGraph(modules[i].file, 'documentation/modules/' + modules[i].name, 'f').then(() => {
                        i++;
                        loop();
                    }, (errorMessage) => {
                        logger.error(errorMessage);
                    });
                } else {
                    let finalTime = (new Date() - startTime) / 1000;
                    logger.info('Documentation generated in ' + program.output + 'in ' + finalTime + ' seconds');
                }
            };
        $ngdengine.renderGraph(program.file, 'documentation/graph', 'p').then(() => {
            loop();
        }, (err) => {
            logger.error('Error during graph generation: ', err);
        });
    }

    export let run = () => {

        let _file;

        if (program.serve) {
            logger.info('Serving documentation at http://127.0.0.1:8080');
            LiveServer.start({
                root: program.output,
                open: false,
                quiet: true,
                logLevel: 0
            });
        }

        if (program.hideGenerator) {
            $configuration.mainData.hideGenerator = true;
        }

        if (program.file) {
            if (!fs.existsSync(program.file)) {
                logger.fatal('"tsconfig.json" file was not found in the current directory');
                process.exit(1);
            } else {
                _file = path.join(
                  path.join(process.cwd(), path.dirname(program.file)),
                  path.basename(program.file)
                );
                logger.info('Using tsconfig', _file);

                files = require(_file).files;

                // use the current directory of tsconfig.json as a working directory
                cwd = _file.split(path.sep).slice(0, -1).join(path.sep);

                if (!files) {
                    let exclude = require(_file).exclude || [];

                    var walk = (dir) => {
                        let results = [];
                        let list = fs.readdirSync(dir);
                        list.forEach((file) => {
                            if (exclude.indexOf(file) < 0) {
                                file = path.join(dir, file);
                                let stat = fs.statSync(file);
                                if (stat && stat.isDirectory()) {
                                    results = results.concat(walk(file));
                                }
                                else if (/(spec|\.d)\.ts/.test(file)) {
                                    logger.debug('Ignoring', file);
                                }
                                else if (path.extname(file) === '.ts') {
                                    logger.debug('Including', file);
                                    results.push(file);
                                }
                            }
                        });
                        return results;
                    };

                    files = walk(cwd || '.');
                }

                $htmlengine.init().then(() => {
                    processPackageJson();
                });
            }
        } else {
            logger.fatal('Entry file was not found');
            outputHelp();
        }
    }
}
