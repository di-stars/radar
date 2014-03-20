var logging = require('minilog')('persistence'),
    establishConnection = require('./connection.js').establishConnection,
    teardownConnection = require('./connection.js').teardownConnection,
    // defaults
    useConfig = 'default',
    configuration = {};

function Persistence() { }


var client, subscriber;

Persistence.connect = function(done) {
  var connectionSetting = {};

  if(configuration.redis_host || configuration.redis_port) {
    connectionSetting.redis_host = configuration.redis_host || 'localhost';
    connectionSetting.redis_port = configuration.redis_port || 6379;
    useConfig = 'deprecated';
  } else {
    connectionSetting = configuration[useConfig];
  }

  establishConnection(useConfig, connectionSetting, function(err, connection) {
    client = connection.client;
    subscriber = connection.subscriber;
    done();
  });
};

function redis() {
  if(!client || !client.connected) {
    throw new Error("Not connected to redis");
  }
  return client;
}

function pubsub() {
  if(!subscriber || !subscriber.connected) {
    throw new Error("Not connected to redis");
  }
  return subscriber;
}

Persistence.redis = function(value) {
  if (value) {
    client = value;
    client_connected = true;
  } else {
    return redis();
  }
};

Persistence.pubsub = function(value) {
  if(value) {
    subscriber = value;
    subscriber_connected = true;
  } else {
    return pubsub();
  }
};

Persistence.setConfig = function(config) {
  configuration = config;
};

Persistence.useConfig = function(config_name) {
  useConfig = config_name || 'default';
};

Persistence.applyPolicy = function(multi, key, policy) {
  if(policy.maxCount) {
    multi.zremrangebyrank(key, 0, -policy.maxCount-1, function(err, res) {
      logging.info('Enforce max count: '+(0-policy.maxCount-1)+' removed '+res);
      if(err) throw new Error(err);
    });
  }

  if(policy.maxAgeSeconds) {
    var maxScore = Date.now()-policy.maxAgeSeconds * 1000;
    multi.zremrangebyscore(key, 0, maxScore, function(err, res) {
      logging.info('Enforce max age ('+key+'): '+new Date(maxScore).toUTCString()+' removed '+res);
      if(err) throw new Error(err);
    });
  }
};

Persistence.readOrderedWithScores = function(key, policy, callback) {
  var multi = redis().multi();

  switch(arguments.length) {
    case 3:
      if (policy) Persistence.applyPolicy(multi, key, policy);
      break;
    case 2:
      callback = policy; // policy is optional
  }

  // sync up to 100 messages, starting from the newest
  multi.zrange(key, -100, -1, 'WITHSCORES', function (err, replies) {
    if(err) throw new Error(err);
    logging.info(key+' '+ (replies.length /2) + ' items to sync');

    // (nherment) TODO: deserialize the result here because it is being serialized in persistOrdered()
    // The problem is that radar_client currently deserializes the response.
    // We need to make the client not deserialize the response so that we can deserialize it here.

    callback(replies);
  });

  multi.exec();
};

Persistence.persistOrdered = function(key, value, callback) {
  redis().zadd(key, Date.now(), JSON.stringify(value), callback);
};

Persistence.delWildCard = function(expr, callback) {
  redis().keys(expr, function(err, results) {
    if(err) throw new Error(err);
    var counter = 0;
    if(!results.length) {
      return callback();
    }
    results.forEach(function(key) {
      Persistence.del(key, function() {
        counter++;
        if (counter == results.length) {
          callback();
        }
      });
    });
  });
};

Persistence.del = function(key, callback) {
  logging.info('deleting', key);
  redis().del(key, callback);
};

Persistence.readHashAll = function(hash, callback) {
  redis().hgetall(hash, function (err, replies) {
    if(err) throw new Error(err);
    if(replies) {
      Object.keys(replies).forEach(function(attr) {
        try {
          replies[attr] = JSON.parse(replies[attr]);
        } catch(parseError) {
          logging.error('Corrupted key value in redis [' + hash + '][' + attr + ']. ' + parseError.message + ': '+ parseError.stack);
          delete replies[attr];
        }
      });
    }
    callback(replies);
  });
};

Persistence.persistHash = function(hash, key, value) {
  logging.info('persistHash:', hash, key, value);
  redis().hset(hash, key, JSON.stringify(value), Persistence.handler);
};

Persistence.expire = function(key, seconds) {
  logging.info('expire', key, seconds);
  redis().expire(key, seconds, Persistence.handler);
};

Persistence.ttl = function(key, callback) {
  redis().ttl(key, callback);
};

Persistence.deleteHash = function(hash, key) {
  logging.info('deleteHash:', hash, key);
  redis().hdel(hash, key, Persistence.handler);
};

Persistence.publish = function(key, value, callback) {
  logging.info('Redis pub:', key, value);
  redis().publish(key, JSON.stringify(value), callback);
};

Persistence.disconnect = function(callback) {
  teardownConnection(useConfig, callback);
};

Persistence.keys = function(key, callback) {
  redis().keys(key, callback);
};

Persistence.handler = function(err) {
  if (err) {
    logging.error(err);
  }
};

Persistence.incrby = function(key, incr) {
  redis().incrby(key, incr, Persistence.handler);
};

Persistence.select = function(index) {
  redis().select(index, Persistence.handler);
};

module.exports = Persistence;
