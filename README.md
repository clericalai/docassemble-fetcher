This provides a web page where people can look up information about a 
Philadelphia property.

It depends on API keys/username/passwords for:

* The PLA docket parser
* Google Maps API
* Google Street View API
* Philadox
* The Fetcher itself

These can be set in the Configuration.  For example:

```
docket api key: xxx_secret_xxx
google:
  api key: hweirwji-secretkey-jfiinfiwefw
philadox username: smithj
philadox password: xxpdpasswordxx
fetcher password: xxsecretpass
```

Configuration for an e-mail server must also be provided.
