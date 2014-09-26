set -ex

# Prerequisites
sudo apt-get update
sudo apt-get dist-upgrade -y
sudo apt-get install -y libpcre3-dev libssl-dev postgresql libpq-dev redis-server nodejs npm libvips-dev libgraphicsmagick-dev
sudo ln -s /usr/bin/nodejs /usr/bin/node # node-bcrypt bug

# Nginx
tar xf nginx-1.7.5.tar.gz
cd nginx-1.7.5/
./configure --with-ipv6 --with-http_ssl_module --with-http_spdy_module
make
sudo make install
cd ../

sudo cp nginx.conf /usr/local/nginx/conf/nginx.conf
test -e /usr/local/nginx/logs/nginx.pid && sudo /usr/local/nginx/sbin/nginx -s stop
sudo /usr/local/nginx/sbin/nginx

sudo cp nginx /etc/init.d/nginx
sudo chmod +x /etc/init.d/nginx
sudo update-rc.d nginx defaults

# PostgreSQL
sudo -u postgres createuser fa
sudo -u postgres createdb -O fa -E UTF8 fa
sudo cp pg_hba.conf /etc/postgresql/9.3/main/pg_hba.conf
sudo service postgresql restart

# Application
sudo cp phoenix /usr/bin/phoenix
sudo chmod +x /usr/bin/phoenix

cd /vagrant/
npm install
sudo npm install -g forever
nodejs models/migrate
sed -i "s|\"key\": null|\"key\": \"$(dd if=/dev/urandom bs=64 count=1 | base64 -w 0)\"|" config.json
echo username | nodejs models/add-test-data
