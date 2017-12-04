var casper = require('casper').create();

// {
//   verbose: true,
//   logLevel: "debug",
//   pageSettings: {
//     webSecurityEnabled: false
//   }
// }

casper.options.viewportSize = {width: 1024, height: 1280};
casper.options.waitTimeout = 10000;

casper.start();

casper.page.paperSize = {
  width: '8.5in',
  height: '11in',
  orientation: 'portrait',
  border: '0.25in',
};

casper.open("http://www.phila.gov/revenue/realestatetax/").then(function(){
  this.fill("form#aspnetForm", {'ctl00$BodyContentPlaceHolder$SearchByAddressControl$txtLookup': decodeURIComponent(casper.cli.get(0))}, false);
  this.click('#ctl00_BodyContentPlaceHolder_SearchByAddressControl_btnLookup');
});

casper.then(function(){
  this.wait(2000, function(){
    if (this.exists("#ctl00_BodyContentPlaceHolder_SearchByAddressControl_ddlAddresses")){
      this.click('#ctl00_BodyContentPlaceHolder_SearchByAddressControl_btnTaxbyAddress');
    }
  });
});

casper.then(function(){
  casper.waitForSelector('#ctl00_BodyContentPlaceHolder_GetTaxInfoControl_hcBrtNum', function(){
    this.evaluate(function(){
      document.body.style.zoom = '0.48';
    });
  });
});

casper.then(function(){
  this.capture(casper.cli.get(1));
});

casper.run();
