﻿/// <reference path="~/node_modules/grunt/lib/grunt.js" />
/// <reference path="~/node_modules/grunt/lib/util/task.js"/>
/// <reference path="~/node_modules/gulp/index.js"/>
/// <reference path="~/node_modules/requirejs/require.js"/>

'use strict';

module.exports = function (grunt) {
    var path = require('path');
    // include gulp
    var gulp = require('gulp');
    // include plug-ins
    var rimraf = require('gulp-rimraf');
    var uglify = require('gulp-uglify');
    var newer = require('gulp-newer');
    var useref = require('gulp-useref');
    var gulpif = require('gulp-if');
    var minifyCss = require('gulp-minify-css');
    var gulpReplace = require('gulp-replace');
    var webRoot = 'wwwroot/';

    //Deployment config
    var config = require('./wwwroot_build/publish/config.json');

    // Project configuration.
    grunt.initConfig({
        karma: {
            unit: {
                configFile: 'tests/karma.conf.js',
                singleRun: true,
                browsers: ['PhantomJS'],
                logLevel: 'ERROR'
            }
        },
        msbuild: {
            release: {
                src: ['TechStacks.csproj'],
                options: {
                    projectConfiguration: 'Release',
                    targets: ['Clean', 'Rebuild'],
                    stdout: true,
                    version: 4.0,
                    maxCpuCount: 4,
                    buildParameters: {
                        WarningLevel: 2
                    },
                    verbosity: 'quiet'
                }
            }
        },
        nugetrestore: {
            restore: {
                src: 'packages.config',
                dest: '../../packages/'
            }
        },
        msdeploy: {
            pack: {
                options: {
                    verb: 'sync',
                    source: {
                        iisApp: path.resolve('./wwwroot')
                    },
                    dest: {
                        'package': path.resolve('./webdeploy.zip')
                    },
                    skip: {
                        Directory:'\\App_Data'
                    }
                }
            },
            push: {
                options: {
                    verb: 'sync',
                    allowUntrusted: 'true',
                    source: {
                        'package': path.resolve('./webdeploy.zip')
                    },
                    dest: {
                        iisApp: config.iisApp,
                        wmsvc: config.serverAddress,
                        UserName: config.userName,
                        Password: config.password
                    }
                }
            }
        },
        gulp: {
            'wwwroot-clean-dlls': function () {
                return gulp.src(webRoot + '/bin/**/*.*', { read: false })
                    .pipe(rimraf());
            },
            'wwwroot-copy-bin': function () {
                var binDest = webRoot + 'bin/';
                var dest = gulp.dest(binDest).on('end', function () {
                    grunt.log.ok('wwwroot-copy-bin finished.');
                });
                return gulp.src('./bin/**/*')
                    .pipe(newer(binDest))
                    .pipe(dest);
            },
            'wwwroot-copy-webconfig': function () {
                return gulp.src('./web.config')
                    .pipe(newer(webRoot))
                    .pipe(gulpReplace('<compilation debug="true" targetFramework="4.5">', '<compilation targetFramework="4.5">'))
                    .pipe(gulp.dest(webRoot));
            },
            'wwwroot-copy-asax': function () {
                return gulp.src('./Global.asax')
                    .pipe(newer(webRoot))
                    .pipe(gulp.dest(webRoot));
            },
            'wwwroot-clean-client-assets': function () {
                return gulp.src([
                    webRoot + '**/*.*',
                    '!./wwwroot/bin/**/*.*', //Don't delete dlls
                    '!./wwwroot/**/*.asax', //Don't delete asax
                    '!./wwwroot/**/*.config', //Don't delete config
                    '!./wwwroot/appsettings.txt', //Don't delete deploy settings
                    '!./wwwroot/licence.txt' //Don't delete licence file
                ], { read: false })
                        .pipe(rimraf());
            },
            'wwwroot-copy-partials': function () {
                var partialsDest = webRoot + 'partials';
                return gulp.src('partials/**/*.html')
                    .pipe(newer(partialsDest))
                    .pipe(gulp.dest(partialsDest));
            },
            'wwwroot-copy-fonts': function () {
                return gulp.src('./bower_components/bootstrap/dist/fonts/*.*')
                    .pipe(gulp.dest(webRoot + 'lib/fonts/'));
            },
            'wwwroot-copy-chosen-resources': function () {
                return gulp.src('./bower_components/chosen/*.png')
                    .pipe(gulp.dest(webRoot + 'lib/css/'));
            },
            'wwwroot-copy-images': function () {
                return gulp.src('./img/*.*')
                    .pipe(gulp.dest(webRoot + 'img/'));
            },
            'wwwroot-bundle': function () {
                var assets = useref.assets();

                return gulp.src('index.html')
                    .pipe(assets)
                    .pipe(gulpif('*.js', uglify()))
                    .pipe(gulpif('*.css', minifyCss()))
                    .pipe(assets.restore())
                    .pipe(useref())
                    .pipe(gulp.dest(webRoot));
            },
            'wwwroot-copy-appsettings': function () {
                return gulp.src('./wwwroot_build/publish/appsettings.txt')
                    .pipe(newer(webRoot))
                    .pipe(gulp.dest(webRoot));
            },
            'wwwroot-copy-licence': function() {
                return gulp.src('./wwwroot_build/publish/licence.txt')
                    .pipe(newer(webRoot))
                    .pipe(gulp.dest(webRoot));
            }
        }
    });

    grunt.loadNpmTasks('grunt-karma');
    grunt.loadNpmTasks('ssvs-utils');
    grunt.loadNpmTasks('grunt-gulp');
    grunt.loadNpmTasks('grunt-msbuild');
    grunt.loadNpmTasks('grunt-nuget');

    grunt.registerTask('01-run-tests', ['karma']);
    grunt.registerTask('02-package-server', [
        'nugetrestore',
        'msbuild:release',
        'gulp:wwwroot-clean-dlls',
        'gulp:wwwroot-copy-bin',
        'gulp:wwwroot-copy-webconfig',
        'gulp:wwwroot-copy-asax',
        'gulp:wwwroot-copy-appsettings',
        'gulp:wwwroot-copy-licence'
    ]);
    grunt.registerTask('03-package-client', [
        'gulp:wwwroot-clean-client-assets',
        'gulp:wwwroot-copy-partials',
        'gulp:wwwroot-copy-fonts',
        'gulp:wwwroot-copy-chosen-resources',
        'gulp:wwwroot-copy-images',
        'gulp:wwwroot-bundle'
    ]);

    grunt.registerTask('04-deploy-app', ['msdeploy:pack', 'msdeploy:push']);
};