VAGRANTFILE_API_VERSION = '2'

Vagrant.configure(VAGRANTFILE_API_VERSION) do |config|
	config.vm.box = 'ubuntu/trusty64'

	config.vm.network 'forwarded_port', guest: 80, host: 2200

	config.vm.provision 'file', source: 'vagrant/nginx-1.7.5.tar.gz', destination: 'nginx-1.7.5.tar.gz'
	config.vm.provision 'file', source: 'vagrant/nginx.conf', destination: 'nginx.conf'
	config.vm.provision 'file', source: 'vagrant/nginx', destination: 'nginx'
	config.vm.provision 'file', source: 'vagrant/pg_hba.conf', destination: 'pg_hba.conf'
	config.vm.provision 'file', source: 'vagrant/phoenix', destination: 'phoenix'
	config.vm.provision 'shell', path: 'vagrant/setup.sh', privileged: false

	config.vm.post_up_message = <<END
Done! The server can be started using:

    $ vagrant ssh -c phoenix

and will then be available at http://localhost:2200/.
END
end
