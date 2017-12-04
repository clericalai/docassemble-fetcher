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
var linklist = [];
var sdlinklist = [];
var latestDeed = {'year': '', 'month': '', 'day': ''};
var args = JSON.parse(decodeURIComponent(casper.cli.get(0)));
var addrNumber = args[0];
var addrDirection = args[1];
var addrStreet = args[2];
var outputDir = args[3];
var username = args[4];
var password = args[5];
casper.options.waitTimeout = 10000;

casper.echo("eagleweb.js: starting 1");

casper.options.viewportSize = {width: 1024, height: 1280};

casper.echo("eagleweb.js: starting 2");

casper.start('http://epay.phila-records.com/phillyepay/web/');

casper.page.paperSize = {
  width: '8.5in',
  height: '11in',
  orientation: 'portrait',
  border: '0.5in'
};

casper.then(function(){
  this.waitForSelector('form.splash', function(){
    casper.echo("eagleweb.js: got splash");
  });
});

// casper.then(function() {
//   casper.echo("Capturing1");
//   this.capture('/tmp/foo1.png');
// });

casper.then(function(){
  casper.echo("eagleweb.js: looking for submit");
  this.evaluate(function(){
    var button = document.querySelector('input[name="submit"]');
    if (button !== null){
      button.click();
    }
  });
});

casper.then(function() {
  casper.echo("Capturing2");
  this.capture('/tmp/foo2.png');
});

// , function() {
//   this.fill('form.splash', {}, true);
// });

casper.then(function(){
  casper.echo("eagleweb.js: looking for form");
  this.wait(8000, function(){
    this.fill('form', {'userId': username, 'password': password}, false)
    //this.fill('form', {'userId': 'barbourl', 'password': 'airtemp67'}, true)
  });
});

// casper.then(function() {
//   casper.echo("Capturing3");
//   this.capture('/tmp/foo3.png');
// });

casper.then(function(){
  this.wait(3000, function(){
    this.evaluate(function(){
      var loginbox = document.querySelector('form');
      if (loginbox !== null){
	var button = document.querySelector('form input[type="submit"]');
	if (button !== null){
	  button.click();
	}
      }
    });
  });
});

// casper.then(function() {
//   casper.echo("Capturing4");
//   this.capture('/tmp/foo4.png');
// });

//casper.waitForSelector('div#tabcontentcontainer', function(){
//  casper.echo("Done logging in");
//});


casper.open('http://epay.phila-records.com/phillyepay/eagleweb/customSearch.jsp').then(function(){
  casper.echo("eagleweb.js: opening customSearch");
  // this.capture('/tmp/foo4.5.png');
  this.wait(3000, function(){
    this.fill('form', {'SitusIDHouseNumber': addrNumber, 'SitusIDDirectionSuffix': addrDirection, 'SitusIDStreetName': addrStreet}, true);
  });
});

// casper.then(function() {
//   casper.echo("Capturing5");
//   this.capture('/tmp/foo5.png');
// });

casper.then(function() {
  this.evaluate(function(){
    sortDir('dsc');
  });
});

casper.then(function() {
  this.click('div#middle a.print');
});

casper.then(function(){
  this.capture(outputDir + '/Philadox-listing.pdf');
});

casper.thenOpen('http://epay.phila-records.com/phillyepay/eagleweb/customSearch.jsp?pageId=Deed', function(){
  this.fill('form', {'SitusIDHouseNumber': addrNumber, 'SitusIDDirectionSuffix': addrDirection, 'SitusIDStreetName': addrStreet, '__search_select': ['D']}, true)
});

casper.then(function() {
  this.evaluate(function(){
    sortDir('dsc');
  });
});

casper.then(function() {
  var returnVal = this.evaluate(function(){
    var searchText = "DEED";
    var hrefPart = "viewDoc";
    var theLength = searchText.length;
    var links = [];
    var latestDeed = {'year': '', 'month': '', 'day': ''};
    var aTags = document.getElementsByTagName("a");
    for (var i = 0; i < aTags.length; i++) {
      if (aTags[i].textContent.substring(0, theLength) == searchText) {
	if (aTags[i].href.indexOf(hrefPart) > -1){
	  var grantor = '';
	  var grantee = '';
	  var recording_date = '';
	  var row = aTags[i].parentNode.parentNode.parentNode;
	  var tdTags = row.getElementsByTagName("td");
	  for (var j = 0; j < tdTags.length; j++){
	    if (tdTags[j].textContent.indexOf('Grantor:') == 0){
	      grantor = tdTags[j].textContent.substring(9);
	    }
	    else if (tdTags[j].textContent.indexOf('Grantee:') == 0){
	      grantee = tdTags[j].textContent.substring(9);
	    }
	  }
	  var rdTags = row.getElementsByTagName("a");
	  for (var j = 0; j < rdTags.length; j++){
	    if (rdTags[j].textContent.indexOf('Rec. Date:') > -1) {
	      recording_date = rdTags[j].textContent.substring(12, 34);
	      if (latestDeed.year == ''){
		var reg = /([0-9][0-9])\/([0-9][0-9])\/([0-9][0-9][0-9][0-9])/;
		var m = reg.exec(recording_date);
		if (m){
		  latestDeed.month = m[1];
		  latestDeed.day   = m[2];
		  latestDeed.year  = m[3];
		}
	      }
	    }
	  }
	  links.push({'href': aTags[i].href, 'grantor': grantor, 'grantee': grantee, 'date': recording_date});
	}
      }
    }
    return([latestDeed, links]);
  });
  latestDeed = returnVal[0];
  if (latestDeed.year != ''){
    latestDeed.date = Date.parse(latestDeed.year + '-' + latestDeed.month + '-' + latestDeed.day);
  }
  this.echo("Latest deed is " + latestDeed);
  linklist = returnVal[1];
});

casper.then(function(){
  var filename = 'deed';
  this.echo("Trying to cycle through deed linklist");
  var i = 1;
  if (linklist.length > 2){
    linklist = linklist.slice(0, 2);
  }
  this.echo(linklist);
  this.eachThen(linklist, function(response){
    this.echo("Trying " + response.data.href);
    this.open(response.data.href).then(function(){
      var pdflink = this.evaluate(function(){
	var aTags = document.getElementsByTagName("a");
	var searchText = "View attachment";
	theLength = searchText.length;
	for (var j = 0; j < aTags.length; j++) {
	  if (aTags[j].textContent.substring(0, theLength) == searchText) {
	    if (aTags[j].href.indexOf('downloads') > -1){
	      return(aTags[j].href);
	    }
	  }
	}
      });
      this.echo("pdflink is " + pdflink);
      if (pdflink){
	this.echo("Trying to download " + pdflink);
	var nicename = '';
	var m;
	if (m = response.data.date.match(/[0-9][0-9][0-9][0-9]/g)){
	  nicename += m[0] + '_'; 
	}
	nicename += filename + "_";
	nicename += response.data.grantee.replace(/[^A-Za-z]+/g, '_').substring(0, 16);
	this.download(pdflink, outputDir + '/' + nicename + '.pdf');
      }
      else{
	this.echo("Could not get pdflink");
      }
      var backlink = this.evaluate(function(){
	var aTags = document.getElementsByTagName("a");
	var searchText = "Return to Search";
	theLength = searchText.length;
	for (var j = 0; j < aTags.length; j++) {
	  if (aTags[j].textContent.substring(0, theLength) == searchText) {
	    if (aTags[j].href.indexOf('docSearch') > -1){
	      return(aTags[j].href);
	    }
	  }
	}
      });
      if (backlink){
	this.echo("Trying to go back.");
	this.open(backlink).then(function(){
	  this.echo("Went back to search results.");
	});
      }
      else{
	this.echo("Could not find back link");
      }
    }).then(function(){
      this.echo("Reached end of loop");
    });
  });
});

casper.thenOpen('http://epay.phila-records.com/phillyepay/eagleweb/customSearch.jsp?pageId=Deed', function(){
  this.fill('form', {'SitusIDHouseNumber': addrNumber, 'SitusIDDirectionSuffix': addrDirection, 'SitusIDStreetName': addrStreet, '__search_select': ['DS']}, true)
});

casper.then(function() {
  this.evaluate(function(){
    sortDir('dsc');
  });
});

casper.then(function() {
  var returnVal = this.evaluate(function(){
    var searchText = "DEED SHERIFF";
    var hrefPart = "viewDoc";
    var theLength = searchText.length;
    var links = [];
    var latestDeed = {'year': '', 'month': '', 'day': ''};
    var aTags = document.getElementsByTagName("a");
    for (var i = 0; i < aTags.length; i++) {
      if (aTags[i].textContent.substring(0, theLength) == searchText) {
	if (aTags[i].href.indexOf(hrefPart) > -1){
	  var grantor = '';
	  var grantee = '';
	  var recording_date = '';
	  var row = aTags[i].parentNode.parentNode.parentNode;
	  var tdTags = row.getElementsByTagName("td");
	  for (var j = 0; j < tdTags.length; j++){
	    if (tdTags[j].textContent.indexOf('Grantor:') == 0){
	      grantor = tdTags[j].textContent.substring(9);
	    }
	    else if (tdTags[j].textContent.indexOf('Grantee:') == 0){
	      grantee = tdTags[j].textContent.substring(9);
	    }
	  }
	  var rdTags = row.getElementsByTagName("a");
	  for (var j = 0; j < rdTags.length; j++){
	    if (rdTags[j].textContent.indexOf('Rec. Date:') > -1) {
	      recording_date = rdTags[j].textContent.substring(12, 34);
	      if (latestDeed.year == ''){
		var reg = /([0-9][0-9])\/([0-9][0-9])\/([0-9][0-9][0-9][0-9])/;
		var m = reg.exec(recording_date);
		if (m){
		  latestDeed.month = m[1];
		  latestDeed.day   = m[2];
		  latestDeed.year  = m[3];
		}
	      }
	    }
	  }
	  links.push({'href': aTags[i].href, 'grantor': grantor, 'grantee': grantee, 'date': recording_date});
	}
      }
    }
    return([latestDeed, links]);
  });
  sdlinklist = returnVal[1];
});

casper.then(function(){
  var filename = 'sheriff_deed';
  this.echo("Trying to cycle through sheriff deed linklist");
  var i = 1;
  if (sdlinklist.length > 2){
    sdlinklist = sdlinklist.slice(0, 2);
  }
  this.echo(sdlinklist);
  this.eachThen(sdlinklist, function(response){
    this.echo("Trying " + response.data.href);
    this.open(response.data.href).then(function(){
      var pdflink = this.evaluate(function(){
	var aTags = document.getElementsByTagName("a");
	var searchText = "View attachment";
	theLength = searchText.length;
	for (var j = 0; j < aTags.length; j++) {
	  if (aTags[j].textContent.substring(0, theLength) == searchText) {
	    if (aTags[j].href.indexOf('downloads') > -1){
	      return(aTags[j].href);
	    }
	  }
	}
      });
      this.echo("pdflink is " + pdflink);
      if (pdflink){
	this.echo("Trying to download " + pdflink);
	var nicename = '';
	var m;
	if (m = response.data.date.match(/[0-9][0-9][0-9][0-9]/g)){
	  nicename += m[0] + '_'; 
	}
	nicename += filename + "_";
	nicename += response.data.grantee.replace(/[^A-Za-z]+/g, '_').substring(0, 16);
	this.download(pdflink, outputDir + '/' + nicename + '.pdf');
      }
      else{
	this.echo("Could not get pdflink");
      }
      var backlink = this.evaluate(function(){
	var aTags = document.getElementsByTagName("a");
	var searchText = "Return to Search";
	theLength = searchText.length;
	for (var j = 0; j < aTags.length; j++) {
	  if (aTags[j].textContent.substring(0, theLength) == searchText) {
	    if (aTags[j].href.indexOf('docSearch') > -1){
	      return(aTags[j].href);
	    }
	  }
	}
      });
      if (backlink){
	this.echo("Trying to go back.");
	this.open(backlink).then(function(){
	  this.echo("Went back to search results.");
	});
      }
      else{
	this.echo("Could not find back link");
      }
    }).then(function(){
      this.echo("Reached end of loop");
    });
  });
});

casper.thenOpen('http://epay.phila-records.com/phillyepay/eagleweb/customSearch.jsp?pageId=Mortgage', function(){
  if (false){
    var theDate = latestDeed.month + '/' + latestDeed.day + '/' + latestDeed.year;
    this.echo("The date is " + theDate);
    this.fill('form', {'SitusIDHouseNumber': addrNumber, 'SitusIDDirectionSuffix': addrDirection, 'SitusIDStreetName': addrStreet, 'RecordingDateIDStart': theDate}, true);
  }
  else{
    this.fill('form', {'SitusIDHouseNumber': addrNumber, 'SitusIDDirectionSuffix': addrDirection, 'SitusIDStreetName': addrStreet}, true);
  }
});

casper.then(function() {
  this.evaluate(function(){
    sortDir('dsc');
  });
});

casper.then(function() {
  linklist = this.evaluate(function(){
    var searchText = "MORTGAGE";
    var hrefPart = "viewDoc";
    var theLength = searchText.length;
    var links = [];
    var aTags = document.getElementsByTagName("a");
    for (var i = 0; i < aTags.length; i++) {
      if (aTags[i].textContent.substring(0, theLength) == searchText) {
	if (aTags[i].href.indexOf(hrefPart) > -1){
	  var grantor = '';
	  var grantee = '';
	  var recording_date = '';
	  var row = aTags[i].parentNode.parentNode.parentNode;
	  var tdTags = row.getElementsByTagName("td");
	  for (var j = 0; j < tdTags.length; j++){
	    if (tdTags[j].textContent.indexOf('Grantor:') == 0){
	      grantor = tdTags[j].textContent.substring(9);
	    }
	    else if (tdTags[j].textContent.indexOf('Grantee:') == 0){
	      grantee = tdTags[j].textContent.substring(9);
	    }
	  }
	  var rdTags = row.getElementsByTagName("a");
	  for (var j = 0; j < rdTags.length; j++){
	    if (rdTags[j].textContent.indexOf('Rec. Date:') > -1) {
	      recording_date = rdTags[j].textContent.substring(12, 34);
	    }
	  }
	  links.push({'href': aTags[i].href, 'grantor': grantor, 'grantee': grantee, 'date': recording_date});
	}
      }
    }
    return(links);
  });
});

casper.then(function(){
  var filename = 'mtg';
  this.echo("Trying to cycle through mortgage linklist");
  if (latestDeed.year == '' && linklist.length > 2){
    linklist = linklist.slice(0, 2);
  }
  else{
    linklist = linklist.slice(0, 6);
  }
  var i = 1;
  var numSaved = 0;
  var noMore = 0;
  this.eachThen(linklist, function(response){
    this.echo("Trying " + response.data.href);
    if (latestDeed.year != '' && Date.parse(response.data.date) < latestDeed.date && numSaved > 0){
      noMore = 1;
    }
    this.open(response.data.href).then(function(){
      var pdflink = this.evaluate(function(){
	var aTags = document.getElementsByTagName("a");
	var searchText = "View attachment";
	theLength = searchText.length;
	for (var j = 0; j < aTags.length; j++) {
	  if (aTags[j].textContent.substring(0, theLength) == searchText) {
	    if (aTags[j].href.indexOf('downloads') > -1){
	      return(aTags[j].href);
	    }
	  }
	}
      });
      this.echo("pdflink is " + pdflink);
      if (pdflink){
	this.echo("Trying to download " + pdflink);
	var nicename = '';
	var m;
	if (m = response.data.date.match(/[0-9][0-9][0-9][0-9]/g)){
	  nicename += m[0] + '_'; 
	}
	nicename += filename + "_";
	nicename += response.data.grantee.replace(/[^A-Za-z]+/g, '_').substring(0, 16);
	if (!noMore){
	  this.download(pdflink, outputDir + '/' + nicename + '.pdf');
	  numSaved++;
	}
      }
      else{
	this.echo("Could not get pdflink");
      }
      var backlink = this.evaluate(function(){
	var aTags = document.getElementsByTagName("a");
	var searchText = "Return to Search";
	theLength = searchText.length;
	for (var j = 0; j < aTags.length; j++) {
	  if (aTags[j].textContent.substring(0, theLength) == searchText) {
	    if (aTags[j].href.indexOf('docSearch') > -1){
	      return(aTags[j].href);
	    }
	  }
	}
      });
      if (backlink){
	this.echo("Trying to go back.");
	this.open(backlink).then(function(){
	  this.echo("Went back to search results.");
	});
      }
      else{
	this.echo("Could not find back link");
      }
    }).then(function(){
      this.echo("Reached end of loop");
    });
  });
});

casper.then(function(){
  this.open('http://epay.phila-records.com/phillyepay/web/logout.jsp').then(function() {
    this.echo("Logged out");
  });
});

casper.run();
