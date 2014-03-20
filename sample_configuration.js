module.exports = {
  //Choose the connection to use by  --connection-config=redis
  //Is shared by chatmanager and radar both
  connnection_settings: {
    legacy: {
      redis_host: 'localhost',
      redis_port: 6379
    },
    cluster1: {
      // sentinel master name is required
      id: 'mymaster',
      sentinels: [
      {
        host: 'localhost',
        port: 26379
      },
      {
        host: 'localhost',
        port: 26380
      },
      {
        host: 'localhost',
        port: 26381
      }
    },
    cluster2: {
      id: 'mymaster',
      sentinels: [
      {
        host: 'localhost',
        port: 36379
      },
      {
        host: 'localhost',
        port: 36380
      },
      {
        host: 'localhost',
        port: 36381
      }
    }
  },

  //Radar config: Port for radar to run on.
  //Can be overridden by --port argument.
  port: 8000,

  // Shared by radar, chat manager
  // Accounts are namespaced by subdomain. API calls are directed to
  // subdomains under this domain (e.g., zendesk-acceptance.com)
  app_domain: 'localhost',

  // Radar config: Token secret (Check existing radar recipe)
  auth_secret_key: 'W3hV0Ku7h!tCmoP%ogM981ov2yZ!iG54%gLAaKd5wNnNZ4wWVjg@34CIYM^hJPcH',

  //Radar config: (will be deprecated soon), location of client side log
  log_file: __dirname + '/logs/radar.log',
  //Radar config: (optional), not currently set, interval for datadog reporting
  healthReportInterval: 10000,

  //Radar config: Dev mode settings (Only used in development, leave unchanged)
  dev_mode: {
    key: __dirname+'/server/dev/certs/support_localhost_2012.key',
    cert: __dirname+'/server/dev/certs/support_localhost_2012.crt'
  },

  chat_settings: {

    //Chat manager config: Max redis Expiry for chat_session in seconds
    //Need not be configured.
    key_expiry: 60*60,

    //Chat manager config: Enduser expiry for agent replies (ms)
    //Need not be configured
    enduser_expiry: 60*1000,

    //secret salt for creating chatIds
    //(NOTE: Currently configured, moved into chat_settings)
    chat_secret_salt: '9ndMwCNW8vWm8XC8mDEPvYrU6ndMwCNW8vWm8XC8mDEPvYrU6',
  },

  // Zendesk system users settings
  // Chatmanager config. (But currently also present in radar config and is unused)
  zendesk_system_users: {
    auth_strategy: 'basic', // basic or token strategy
    chat_key: '5f5513f8822fdbe5145af33b64d8d970dcf95c6e0beec7b5ea3f0fdb',
  },
};

