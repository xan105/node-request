
const http2 = require('http2');
const urlParser = require("url");

function request (href, option = {}) {
  
  let options = {
    method: option.method || "GET",
    encoding: option.encoding || "utf8",
    timeout: option.timeout || 100,
    maxRedirect: option.maxRedirect || option.maxRedirect == 0 ? option.maxRedirect : 3,
    maxRetry: option.maxRetry || option.maxRetry == 0 ? option.maxRetry : 0,
    retryDelay: option.retryDelay || 200,
    headers: {
      "User-Agent": "Chrome/",
    }
  };
  
  if (option.headers) Object.assign(options.headers, option.headers);

  const url = urlParser.parse(href);
  const headers = Object.assign(options.headers, {
    ":path" : url.pathname,
    ":method" : options.method.toUpperCase()
  });

  const client = http2.connect(url.href);
  
  let result = {
    code: null,
    message: '',
    url: url.href,
    trace: href
  };
  
  client.on('error', (err) => {
    result.code = err.code;
    result.message = err.message
  });
  
  const req = client.request({...headers});
  
  /* How to handle timeout ?? :todo
  req.setTimeout(options.timeout, () => {
    req.close();
  });*/
  
  req.on('response', (headers, flags) => {
  
    console.log(flags);
  
    result.code = headers[':status'];
    delete headers[':status'];
    result.headers = headers;
  });

  req.setEncoding('utf8');
  req.on('data', (chunk) => { result.body += chunk });
  req.on('end', () => {
    console.log(result);
    client.close();
  })
  
  //? req.on('error', (err) => console.error(err));
  req.end();
}

request("https://www.google.com/");