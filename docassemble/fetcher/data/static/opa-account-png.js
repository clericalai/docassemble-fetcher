var casper = require('casper').create(
  {
    verbose: true,
    logLevel: "debug",
    pageSettings: {
      webSecurityEnabled: false
    }
  }
);

var fs = require('fs');

var url = "http://property.phila.gov/?p=" + casper.cli.get(0);

var opa_number = casper.cli.get(0);

casper.options.viewportSize = {width: 1024, height: 1280};

casper.start(url);

casper.then(function(){
  this.wait(8000, function(){
    this.capture(casper.cli.get(1));
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

casper.waitForSelector('div.property', function(){
  this.evaluate(function(){
    document.getElementById('homestead').value='30000';
    document.querySelector('li > div.above > button').click();
  });
});

casper.then(function() {
  this.capture(casper.cli.get(2));
});

casper.run();
