# frozen_string_literal: true

# Debian host for local Temporal workflow development.
#
# Useful overrides:
#   PRIME_MOVER_VM_IP=192.168.56.50 vagrant up
#   TEMPORAL_VERSION=1.25.2 TEMPORAL_UI_VERSION=2.31.2 vagrant provision
#
# Guest endpoints:
#   Temporal frontend: 192.168.56.50:7233
#   Temporal UI:       http://192.168.56.50:8233

VAGRANTFILE_API_VERSION = "2"

VM_BOX = ENV.fetch("PRIME_MOVER_VM_BOX", "generic/debian12")
VM_HOSTNAME = ENV.fetch("PRIME_MOVER_VM_HOSTNAME", "prime-mover-temporal")
VM_IP = ENV.fetch("PRIME_MOVER_VM_IP", "192.168.56.50")
VM_CPUS = ENV.fetch("PRIME_MOVER_VM_CPUS", "2").to_i
VM_MEMORY = ENV.fetch("PRIME_MOVER_VM_MEMORY", "4096").to_i
TEMPORAL_VERSION = ENV.fetch("TEMPORAL_VERSION", "1.25.2")
TEMPORAL_UI_VERSION = ENV.fetch("TEMPORAL_UI_VERSION", "2.31.2")
POSTGRES_VERSION = ENV.fetch("POSTGRES_VERSION", "16")

Vagrant.configure(VAGRANTFILE_API_VERSION) do |config|
  config.vm.box = VM_BOX
  config.vm.hostname = VM_HOSTNAME

  config.vm.network "private_network", ip: VM_IP
  config.vm.network "forwarded_port", guest: 7233, host: 7233, auto_correct: true
  config.vm.network "forwarded_port", guest: 8233, host: 8233, auto_correct: true

  config.vm.provider "virtualbox" do |vb|
    vb.name = VM_HOSTNAME
    vb.cpus = VM_CPUS
    vb.memory = VM_MEMORY
  end

  config.vm.provision "shell",
                      privileged: true,
                      env: {
                        "TEMPORAL_VERSION" => TEMPORAL_VERSION,
                        "TEMPORAL_UI_VERSION" => TEMPORAL_UI_VERSION,
                        "POSTGRES_VERSION" => POSTGRES_VERSION
                      },
                      inline: <<~SHELL
                        set -eux

                        export DEBIAN_FRONTEND=noninteractive
                        apt-get update
                        apt-get install -y \\
                          ca-certificates \\
                          curl \\
                          docker.io \\
                          git \\
                          golang-go \\
                          make

                        if apt-cache show docker-compose-plugin >/dev/null 2>&1; then
                          apt-get install -y docker-compose-plugin
                        elif apt-cache show docker-compose >/dev/null 2>&1; then
                          apt-get install -y docker-compose
                        fi

                        systemctl enable --now docker
                        usermod -aG docker vagrant

                        install -d -m 0755 /opt/temporal/dynamicconfig
                        install -d -m 0755 /opt/temporal/data/postgres

                        cat >/opt/temporal/dynamicconfig/development-sql.yaml <<'YAML'
                        system.forceSearchAttributesCacheRefreshOnRead:
                          - value: true
                            constraints: {}
                        YAML

                        cat >/opt/temporal/docker-compose.yml <<YAML
                        services:
                          postgresql:
                            image: postgres:${POSTGRES_VERSION}
                            container_name: temporal-postgresql
                            environment:
                              POSTGRES_USER: temporal
                              POSTGRES_PASSWORD: temporal
                              POSTGRES_DB: temporal
                            volumes:
                              - /opt/temporal/data/postgres:/var/lib/postgresql/data
                            healthcheck:
                              test: ["CMD-SHELL", "pg_isready -U temporal"]
                              interval: 10s
                              timeout: 5s
                              retries: 10

                          temporal:
                            image: temporalio/auto-setup:${TEMPORAL_VERSION}
                            container_name: temporal
                            depends_on:
                              postgresql:
                                condition: service_healthy
                            environment:
                              DB: postgres12
                              DB_PORT: "5432"
                              POSTGRES_USER: temporal
                              POSTGRES_PWD: temporal
                              POSTGRES_SEEDS: postgresql
                              DYNAMIC_CONFIG_FILE_PATH: config/dynamicconfig/development-sql.yaml
                              TEMPORAL_ADDRESS: 0.0.0.0:7233
                            ports:
                              - "7233:7233"
                            volumes:
                              - /opt/temporal/dynamicconfig:/etc/temporal/config/dynamicconfig

                          temporal-ui:
                            image: temporalio/ui:${TEMPORAL_UI_VERSION}
                            container_name: temporal-ui
                            depends_on:
                              - temporal
                            environment:
                              TEMPORAL_ADDRESS: temporal:7233
                              TEMPORAL_CORS_ORIGINS: http://localhost:3000,http://127.0.0.1:3000
                            ports:
                              - "8233:8080"
                        YAML

                        cat >/usr/local/bin/temporal-compose <<'SH'
                        #!/usr/bin/env sh
                        set -eu
                        if docker compose version >/dev/null 2>&1; then
                          exec docker compose -f /opt/temporal/docker-compose.yml "$@"
                        fi
                        exec docker-compose -f /opt/temporal/docker-compose.yml "$@"
                        SH
                        chmod 0755 /usr/local/bin/temporal-compose

                        cat >/etc/profile.d/prime-mover-temporal.sh <<'SH'
                        export TEMPORAL_ADDRESS=127.0.0.1:7233
                        SH

                        temporal-compose up -d
                      SHELL

  config.vm.post_up_message = <<~MESSAGE
    Temporal VM is configured.

    Guest Temporal address: #{VM_IP}:7233
    Guest UI:               http://#{VM_IP}:8233

    Useful commands:
      vagrant ssh
      temporal-compose ps
      temporal-compose logs -f temporal
      docker run --rm --network host temporalio/admin-tools:#{TEMPORAL_VERSION} temporal operator cluster health
  MESSAGE
end
