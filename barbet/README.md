### Root for main web page

#### Run containers using:

`docker-compose up --build`

| Option | Example value |                           Meaning                            |
| :----: | :-----------: | :----------------------------------------------------------: |
|  DEV   |   anything    | Enables debug mode, disables minification, watches files etc |
| SERVE  |     8080      |             Enables HTTP server on a given port              |
|  DIST  |    ./dist     |            Outputs compiled files into directory             |

#### Example debug server command:

`DEV= SERVE=3000 DIST=./dist docker-compose up --build`

###### Uses matrix math library [gl-matrix](https://github.com/toji/gl-matrix)

###### Uses noise library [open-simplex-noise-js](https://github.com/joshforisha/open-simplex-noise-js)
