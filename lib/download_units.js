/**
 * Created by cuccpkfs on 15-1-19.
 * give a dbPool, this utility can download file to particular directory
 * node download_units.js db-port db-user output-dir
 */

var Noradle = require('noradle')
  , path = require('path')
  , cfg = require(path.join(process.cwd(), 'schema.json'))
  , dbUser = cfg.schema
  , outDir = cfg.out_dir || '.'
  , useBom = cfg.use_bom
  , bomBuf = new Buffer('EFBBBF', 'hex')
  , fs = require('fs')
  , debug = require('debug')('no-cm:schema2file')
  , env = process.env
  , dbPool = Noradle.DBDriver.connect(env.addr.split(":"), {
    cid : env.cid,
    passwd : env.passwd
  })
  , dbc = new Noradle.NDBC(dbPool, {
    x$dbu : dbUser
  });

dbc.call('adm_export_schema_h.unit_list', {
  __parse : true,
  z$filter : cfg.filter || '%'
}, function(status, headers, units){
  if (status !== 200) {
    console.error(units);
    process.exit(status);
    return;
  }
  if (cfg.install_script) {
    var echoSwitch = cfg.install_script.echo ? 'on' : 'off'
      , usePrompt = !!cfg.install_script.prompt_unit_name
      , lines = [
        "set define off",
        "set echo " + echoSwitch,
        ""
      ]
      , script_text = 'set define off\nset echo ' + echoSwitch + '\n\n@@' + units.join('\n@@') + '\n'
      ;
    units.forEach(function(unit){
      if (usePrompt) {
        lines.push('\r\nprompt\r\nprompt ' + unit.split('.')[0].toUpperCase() + '.' + unit.split('.')[1]);
      }
      lines.push('@@' + unit);
    });
    lines.push('');
    fs.writeFileSync(path.join('.', 'install.sql'), lines.join("\r\n"));
    debug('write %s %s', 'install.sql', 'done');
  }
  var no = -1;

  function next(){
    var unit = units[++no];
    if (!unit) {
      process.exit(0);
    }
    dbc.call('adm_export_schema_h.download', {
      unit : unit
    }, function(status, headers, text){
      if (useBom) {
        var bin = new Buffer('123' + text);
        bomBuf.copy(bin);
        fs.writeFileSync(path.join(outDir, unit), bin);
      } else {
        fs.writeFileSync(path.join(outDir, unit), text);
      }
      debug('write %s %s', unit, 'done');
      next();
    });
  }

  next();
});
