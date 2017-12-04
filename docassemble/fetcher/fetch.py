from docassemble.base.util import DAFile, get_config, DAStaticFile, DARedis, Address
import httplib2
import json
import urllib
import re
import tempfile
import time
import os
from subprocess import call, Popen, PIPE
import sys

pleading_regexps = [r'COMPLAINT FILED NOTICE GIVEN',
                    r'AMENDED COMPLAINT FILED',
                    r'CITY CHARGE',
                    r'TAX CLAIM-PETITION&RULE FILED',
                    r'AMENDED TAX CLAIM FILED',
                    r'CERTIFIED JUDGMENT FILED',
                    r'APPEAL FROM MUNICIPAL COURT',
                    r'PET TO APPOINT SEQUESTRATOR',
                    r'PRAE TO ISSUE WRIT OF SUMMONS',
                    r'PET FOR APPT OF',
                    r'PETITION FOR CITATION',
                    r'ANNUAL REPORT',
                    r'DECREE',
                    r'GUARDIAN APPOINTED',
                    r'DISMISS',
                    r'PETITION TO']

class Property(object):
    def __init__(self, address):
        if isinstance(address, Address):
            address.geolocate()
            the_dict = dict()
            if hasattr(address, 'norm') and hasattr(address.norm, 'street') and hasattr(address.norm, 'street_number'):
                the_dict['number'] = address.norm.street_number
                parts = re.split(r' +', address.norm.street)
                if len(parts) == 1:
                    the_dict['street'] = parts[0]
                elif len(parts) == 2:
                    the_dict['direction'] = ''
                    the_dict['street'] = parts[0]
                    the_dict['type'] = parts[1]
                else:
                    the_dict['direction'] = parts[0]
                    the_dict['street'] = parts[1:-2]
                    the_dict['type'] = parts[-1]
                self.address = the_dict
                return
            else:
                raise Exception("Could not normalize address")
        self.address = address
    def get_opa_page(self):
        if not hasattr(self, 'opa_page'):
            self.fetch_opa_info()
        return self.opa_page
    def get_avi_page(self):
        if not hasattr(self, 'avi_page'):
            self.fetch_opa_info()
        return self.avi_page
    def get_homestead(self):
        if not hasattr(self, 'has_homestead'):
            self.fetch_opa_info()
        return self.has_homestead
    def get_revenue_page(self):
        if not hasattr(self, 'revenue_page'):
            self.fetch_revenue_info()
        return self.revenue_page
    def get_google_street_view_image(self):
        if not hasattr(self, 'google_street_view_image'):
            self.fetch_google_street_view_image()
        return self.google_street_view_image
    def get_google_street_view_pdf(self):
        if not hasattr(self, 'google_street_view_pdf'):
            self.fetch_google_street_view_image()
        return self.google_street_view_pdf
    def fetch_google_street_view_image(self):
        google_api_key = get_config('google', dict()).get('api key', None)
        if google_api_key is None:
            raise Exception("No Google Maps API key")
        street_view_image = tempfile.NamedTemporaryFile(prefix="datemp", suffix=".png")
        google_address = urllib.quote(self.one_line(with_city_state=True))
        the_url = 'https://maps.googleapis.com/maps/api/streetview?size=640x640&location=' + google_address + '&key=' + google_api_key
        #raise Exception("Getting " + the_url + "\n")
        try:
            urllib.urlretrieve(the_url, street_view_image.name)
        except Exception as err:
            raise Exception('Error retrieving Google Street View image')
        street_view_pdf = DAFile()
        street_view_pdf.set_random_instance_name()
        street_view_pdf.initialize(filename="Google_Street_View.pdf")
        png_to_pdf(street_view_image.name, street_view_pdf.path())
        street_view_pdf.retrieve()
        street_view_pdf.commit()
        street_view_png = DAFile()
        street_view_png.set_random_instance_name()
        street_view_png.initialize(filename="Google_Street_View.png")
        street_view_png.copy_into(street_view_image.name)
        street_view_png.retrieve()
        street_view_png.commit()
        self.google_street_view_pdf = street_view_pdf
        self.google_street_view_image = street_view_png
    def one_line(self, with_city_state=False):
        output = self.address['number']
        if self.address['direction']:
            output += ' ' + self.address['direction']
        if self.address['street']:
            output += ' ' + self.address['street']
        if self.address['type']:
            output += ' ' + self.address['type']
        if with_city_state:
            output += ', Philadelphia, PA'
        return output
    def get_philadox_files(self):
        if not hasattr(self, 'philadox_files'):
            self.fetch_philadox_info()
        return self.philadox_files
    def fetch_philadox_info(self):
        r = DARedis()
        while r.get('using_philadox') is not None:
            time.sleep(5)
        pipe = r.pipeline()
        pipe.set('using_philadox', 1)
        pipe.expire('using_philadox', 120)
        pipe.execute()
        tdir = tempfile.mkdtemp()
        info = urllib.quote(json.dumps([self.address['number'], self.address['direction'], self.address['street'], tdir, get_config('philadox username'), get_config('philadox password')]))
        step = ['casperjs', DAStaticFile(filename='eagleweb.js').path(), info]
        result = call(step)
        r.delete('using_philadox')
        if result != 0:
            raise Exception("Failed to fetch Philadox information")
        outfiles = []
        for pdf_file in sorted([f for f in os.listdir(tdir) if f.endswith('.pdf')]):
            new_file = DAFile()
            new_file.set_random_instance_name()
            new_file.initialize(filename=pdf_file)
            new_file.copy_into(os.path.join(tdir, pdf_file))
            new_file.retrieve()
            new_file.commit()
            outfiles.append(new_file)
        self.philadox_files = outfiles
    def fetch_revenue_info(self):
        revenue_page = DAFile()
        revenue_page.set_random_instance_name()
        revenue_page.initialize(filename='Department-of-Revenue.pdf')
        address_escaped = urllib.quote(self.one_line())
        step = ['casperjs', DAStaticFile(filename='revenue.js').path(), address_escaped, revenue_page.path()]
        result = call(step)
        if result != 0:
            time.sleep(5)
            result = call(step)
        if result != 0:
            raise Exception("Failed to fetch Revenue information")
        revenue_page.retrieve()
        revenue_page.commit()
        self.revenue_page = revenue_page
    def fetch_opa_info(self):
        homestead = tempfile.NamedTemporaryFile(prefix="datemp", suffix=".txt")
        opa_image = tempfile.NamedTemporaryFile(prefix="datemp", suffix=".png")
        avi_image = tempfile.NamedTemporaryFile(prefix="datemp", suffix=".png")
        opa_page = DAFile()
        opa_page.set_random_instance_name()
        opa_page.initialize(filename='OPA.pdf')
        avi_page = DAFile()
        avi_page.set_random_instance_name()
        avi_page.initialize(filename='AVI.pdf')
        address_escaped = urllib.quote(self.one_line())
        step = ['casperjs', DAStaticFile(filename='opa-png.js').path(), address_escaped, opa_image.name, avi_image.name, homestead.name]
        sys.stderr.write(" ".join(step) + "\n")
        result = call(step)
        if result != 0:
            time.sleep(5)
            result = call(step)
        if result != 0 and self.address.get('opa', None) is not None:
            step = ['casperjs', DAStaticFile(filename='opa-account-png.js').path(), self.address['opa'], opa_image.name, avi_image.name, homestead.name]
            result = call(step)
            if result != 0:
                time.sleep(5)
                result = call(step)
        if result != 0:
            raise Exception("Failed to fetch OPA information")
        png_to_pdf(opa_image.name, opa_page.path())
        #opa_page.make_pngs()
        opa_page.retrieve()
        opa_page.commit()
        png_to_pdf(avi_image.name, avi_page.path())
        #avi_page.make_pngs()
        avi_page.retrieve()
        avi_page.commit()
        self.opa_page = opa_page
        self.avi_page = avi_page
        homestead.seek(0, 0)
        self.has_homestead = False if homestead.read() == "No" else True

class Docket(object):
    def __init__(self, docketnum):
        self.docketnum = docketnum
        self.docket_fetched = False
        self.address_fetched = False
    def fetch_address_info(self):
        http = httplib2.Http()
        error = None
        try:
            resp, content = http.request("https://docket.philalegal.org/cgi-bin/prop_info.pl?docketnum=" + str(self.docketnum), "GET")
            if int(resp['status']) == 200:
                result = json.loads(content)
            else:
                error = "API call failed."
        except Exception as err:
            error = str(err)
        if error:
            raise Exception(error)
        if not result.get('success', False):
            raise Exception(result.get('error', 'Error getting address info'))
        if 'number' not in result or 'direction' not in result or 'street' not in result or 'type' not in result or 'opa' not in result:
            raise Exception('Invalid response from API')
        self.address_fetched = True
        self.address = dict(number=result['number'], direction=result['direction'], street=result['street'], type=result['type'], opa=result['opa'])
        self.opa_number = result['opa']
        return result
    def get_opa_number(self):
        if not self.address_fetched:
            self.fetch_address_info()
        return self.opa_number
    def get_address(self):
        if not self.address_fetched:
            self.fetch_address_info()
        return self.address
    def get_pleadings_list(self):
        if not hasattr(self, 'pleadings_list'):
            self.fetch_pleadings_list()
        return self.pleadings_list
    def fetch_pleadings_list(self):
        pleadings_list = []
        for info in self.pleadings():
            pleadings_list.append(self.get_pdf(**info))
        self.pleadings_list = pleadings_list
    def get_entries(self):
        if not self.docket_fetched:
            self.fetch_docket()
        return self.docket_info.get('entries', [])
    def fetch_docket(self):
        api_key = get_config('docket api key')
        http = httplib2.Http()
        try:
            resp, content = http.request("https://docket.philalegal.org/docketinfo?docketnum=" + str(self.docketnum) + "&key=" + str(api_key), "GET")
            if int(resp['status']) == 200:
                result = json.loads(content)
            else:
                result = dict(docketnum=self.docketnum, success=False, error="API call failed")
        except Exception as err:
            result = dict(docketnum=self.docketnum, success=False, error=str(err))
        if not result.get('success', False):
            raise Exception(result.get('error', 'There was an error getting the docket'))
        self.docket_info = result
        self.docket_fetched = True
    def pleadings(self):
        result = list()
        fileindex = 1
        for entry in self.get_entries():
            subfileindex = 1;
            is_pleading = False
            for regexp in pleading_regexps:
                if re.search(regexp, entry[2]):
                    is_pleading = True
                    break
            if not is_pleading:
                continue
            numfiles = len(entry[7])
            for href in [y['href'][0] for y in entry[7]]:
                indexno = re.search(r'd\=([0-9]+)', href)
                fileno = re.search(r'b\=([0-9]+)', href)
                pageno = re.search(r'pageno\=([0-9]+)', href)
                if not (indexno and fileno and pageno):
                    continue
	        nicename = entry[2]
	        nicename = re.sub(r'^[^ ]+ - ', r'', nicename)
                nicename = re.sub(r'[^A-Za-z0-9\.]+', r'_', nicename)
                nicename = nicename[0:15]
	        if numfiles > 1:
		    nicename += '_part_' + str(subfileindex)
                    subfileindex += 1
                filename = 'Pleading_%02d_%s.pdf' % (fileindex, nicename)
                result.append(dict(indexno=indexno.group(1), fileno=fileno.group(1), pageno=pageno.group(1), filename=filename))
        return result
    def get_pdf(self, indexno=None, fileno=None, pageno=None, filename=None):
        api_key = get_config('docket api key')
        if indexno is None or fileno is None or pageno is None or filename is None:
            raise Exception("get_pdf: invalid input")
        new_file = DAFile()
        new_file.set_random_instance_name()
        new_file.initialize(filename=filename)
        new_file.from_url("https://docket.philalegal.org/docketinfo?docketnum=" + str(self.docketnum) + '&indexno=' + str(indexno) + '&fileno=' + str(fileno) + '&pageno=' + str(pageno) + "&key=" + api_key)
        #new_file.make_pngs()
        new_file.retrieve()
        new_file.commit()
        return new_file

def png_to_pdf(input_path, output_path):
    file_one = tempfile.NamedTemporaryFile(prefix="datemp", suffix=".pdf", delete=False)
    file_two = tempfile.NamedTemporaryFile(prefix="datemp", suffix=".pdf", delete=False)
    file_three = tempfile.NamedTemporaryFile(prefix="datemp", suffix=".pdf", delete=False)
    file_four = tempfile.NamedTemporaryFile(prefix="datemp", suffix=".pdf", delete=False)
    steps = [['convert', input_path, '-rotate', '180', file_one.name],
             ['pdfposter', '-m', 'letter', '-p', '1x999letter', file_one.name, file_two.name],
             ['pdftk', file_two.name, 'cat', 'end-1south', 'output', file_three.name],
             ['pdfcrop', '--margin', '0 18 0 18', '--bbox', '0 0 612 792', file_three.name, file_four.name],
             ['pdfjam', '--outfile', output_path, '--paper', 'letter', file_four.name]]
    for step in steps:
        sys.stderr.write("Doing " + " ".join(step) + "\n")
        result = call(step)
        if result != 0:
            raise Exception("Image conversion failed")
        
