/* 
* This work has been done by Phillip Ochola Makanyengo
* Email: its2uraps@gmail.com
*
* This work uses open source code and libraries and 
* can therefore be replicated unless certain portions
* are stated otherwise. 
*
* Please refer to the author when using the code.
*
*/

//Nodejs server implementation for the Ihub my energy project


//Importing all the modules
var express = require('express'),
    path = require('path'),
    httpPort = 5050,
    app = express(),
	localhost = "127.0.0.1";


//This sets up the express environment, public is the folder containing the files
express.static.mime.default_type = "text/html";
app.use(express.static(path.join(__dirname, 'web')));

// start http server
app.listen(httpPort, function () {
    console.log('HTTP Server: http://'+localhost+':'+ httpPort);
});