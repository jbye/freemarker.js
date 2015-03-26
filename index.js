
var path = require('path');
var fs = require('fs');
var uuid = require('node-uuid');
var os = require('os');

var fmpp = require('./lib/fmpp.js');

function nop() {}
function getTmpFileName() {
  return path.join(os.tmpDir(), uuid.v4()).replace(/\\/g, '/');
}

function writeTmpFile(data, done) {
  var fileName = getTmpFileName();
  fs.writeFile(fileName, data, function(err) {
    done(err, fileName);
  });
}

/**
 * Freemarker Class
 *
 * @param {Object} settings
 */
function Freemarker(settings) {
  var fmpOpts = settings.options || {};

  if(!settings.viewRoot) {
    throw new Error('Freemarker: Need viewRoot param.')
  }
  if(!fmpOpts.sourceRoot) {
    fmpOpts.sourceRoot = settings.viewRoot;
  }
  if(!fmpOpts.outputRoot) {
    fmpOpts.outputRoot = os.tmpDir();
  }

  // Convert folder seperate in case of Windows
  fmpOpts.sourceRoot = fmpOpts.sourceRoot.replace(/\\/g, '/');
  fmpOpts.outputRoot = fmpOpts.outputRoot.replace(/\\/g, '/');

  this.viewRoot = settings.viewRoot;
  this.options = fmpOpts;
}

/**
 * Convert Object to fmpp configuration content
 *   with TDD syntax, see also http://fmpp.sourceforge.net/tdd.html
 *
 * @param  {Object}   data resource data
 * @return {String} result
 */
function generateConfiguration(data, done) {
  var sName = Object.keys(data || {});
  var result = [];
  sName.forEach(function(x) {
    var value = data[x];
    if(typeof value !== 'boolean') {
      result.push(x + ': ' + value);
    } else if(value === true) {
      // For boolean settings, empty-string is considered as true
      result.push(x);
    }
  });

  return result.join('\n');
}


Freemarker.prototype.render = function(tpl, data, done) {
  var dataTdd = convertDataModel(data);
  var tplFile = path.join(this.viewRoot, tpl).replace(/\\/g, '/');

  // Make configuration file for fmpp
  var cfgDataObject = this.options;
  cfgDataObject.data = dataTdd;

  // Set output file
  var tmpFile = getTmpFileName();
  cfgDataObject.outputFile = tmpFile;

  var cfgContent = generateConfiguration(cfgDataObject);
  writeTmpFile(cfgContent, function getCfgFileName(err, cfgFile) {
    if(err) {
      return done(err);
    }
    var args = [tplFile, '-C', cfgFile];
    fmpp.run(args, function getFMPPResult(err, respData) {
      if(err) {
        return done(err);
      }

      fs.readFile(tmpFile, function(err, result) {
        done(err, '' + result, respData);
        fs.unlink(tmpFile, nop);
        fs.unlink(cfgFile, nop);
      });
    });

  });

  return ;
};

Freemarker.prototype.renderSync = function(tpl, data) {
  var dataTdd = convertDataModel(data);
  var tplFile = path.join(this.viewRoot, tpl);
  var args = [tplFile, '-D', dataTdd];
  var tmpFile;
  var _this = this;

  tmpFile = getTmpFileName();
  args.push.apply(args, ['-o', tmpFile]);
  args.push.apply(args, this.stringifyArgs);

  fmpp.runSync(args);

  var result = fs.readFileSync(tmpFile, {encoding: 'utf8'});
  fs.unlink(tmpFile, nop);
  return result;
};

/**
 * Render views in bulk mode
 * @param  {String}   cfgFile configuration file
 * @param  {Function} done    callback
 */
Freemarker.prototype.renderBulk = function(cfgFile, done) {
  fmpp.run(['-C', cfgFile], done);
};

Freemarker.exec = fmpp.run;

/**
 * Convert data object to TDD
 * @param  {Ojbect} data
 * @return {String}      [description]
 */
function convertDataModel(data) {
  return JSON.stringify(data, true, ' ');
}


Freemarker.version = require('./package.json').version;
Freemarker.getFMPPVersion = function getFMPPVersion(cb) {
  fmpp.run(['--version'], cb);
};

module.exports = Freemarker;
