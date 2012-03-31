#!/bin/bash
set -e

mkdir -p public
cd browser-src

echo "Compiling JADE -> HTML"
jade index.jade > /dev/null
mv index.html ../public/

echo "Compiling LESS -> CSS"
lessc style.less > ../public/style.css

echo "Compiling CommonJS -> BrowserJS"
pakmanager build > /dev/null 2> /dev/null || true
rm pakmanaged.html
mv pakmanaged.*js ../public/

echo "Copying static assets"
rsync -a static/ ../public/

cd ../public
#ps aux | grep -v grep | grep "served 5757 ${PWD}" > /dev/null || nohup served 5757 ${PWD} &

#echo "Done and serving at localhost:5757"
echo "Done"
