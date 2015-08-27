'use strict';
var join = require('path').join;

var gulp = require('gulp');
var babel = require('gulp-babel');
var del = require('del');
var watch = require('gulp-watch');
var chmod = require('gulp-chmod');

gulp.task('clean', function(cb) {
  var dist = [
    'magicserver.js',
    'bin.js',
  ];
  del(dist, cb);
});

gulp.task('build', ['clean', 'build:bin'], function () {
  return gulp.src(join('src', 'magicserver.js'))
    .pipe(babel())
    .pipe(gulp.dest(__dirname));
});

gulp.task('build:bin', function() {
  return gulp.src(join('src', 'bin.js'))
    .pipe(babel())
    .pipe(chmod(755))
    .pipe(gulp.dest(__dirname));
});

gulp.task('watch', ['default'], function() {
  var src = [
    join(__dirname, 'src', '**', '*'),
    join(__dirname, 'gulpfile.js'),
  ];

  watch(src, function() {
    gulp.start('default');
  });
});

gulp.task('default', ['clean', 'build']);
