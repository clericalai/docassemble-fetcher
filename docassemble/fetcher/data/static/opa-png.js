var casper = require('casper').create(
  // {
  //   verbose: true,
  //   logLevel: "debug",
  //   pageSettings: {
  //     webSecurityEnabled: false
  //   }
  // }
);

var fs = require('fs');
var init_url = "http://property.phila.gov";
var url = "http://property.phila.gov/?a=" + casper.cli.get(0) + "&u=";

var opa_number;

casper.options.viewportSize = {width: 1024, height: 1280};
casper.options.waitTimeout = 10000;

casper.start(init_url);

casper.then(function(){
  this.thenOpen(url);
});

casper.then(function(){
  this.wait(8000, function(){
    this.capture(casper.cli.get(1));
  });
});

casper.then(function(){
  opa_number = this.evaluate(function(){
    var el = document.querySelector("strong[data-hook='opa-account']");
    if (el !== null){
      return(el.textContent);
    }
    return(null);
  });
});

casper.then(function(){
  var homestead = this.evaluate(function(){
    return document.querySelector('strong[data-hook="homestead"]').textContent;
  });
  fs.write(casper.cli.get(3), homestead, 'w');
});

casper.page.paperSize = {
  width: '8.5in',
  height: '11in',
  orientation: 'portrait',
  border: '0.5in'
};

casper.thenOpen("http://avicalculator.phila.gov/");

casper.then(function(){
  this.click('li > a[data-value="actnum"]');
});

casper.then(function(){
  casper.fill("div.home > form", {'input': opa_number}, true);
});

casper.wait(7000, function(){
  this.evaluate(function(){
    document.getElementById('homestead').value='30000';
    document.querySelector('li > div.above > button').click();
  });
});

casper.then(function() {
  this.capture(casper.cli.get(2));
});

casper.run();
