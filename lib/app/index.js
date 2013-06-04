var app = require('derby').createApp(module)
  .use(require('../../ui'))

app.get('/', function(page) {
  page.redirect('/story');
});

app.get('/story', function(page, model) {
  var prompts = model.at('config.prompts');
  prompts.fetch(function(err) {
    prompts.setNull([
      "And then she said",
      "The first time I ever",
      "It was a Thursday",
      "Every night I dreamed of falling. Ever since ",
      "And then she slapped me, and said ",
      "The day began like most days since the invasion",
      "There comes a time in every man's life when"
    ]);

    var openGames = model.query('stories', {
      $limit: 1,
      users: {$size: 1},
      startTime: {$exists: false}, done: {$exists: false}
    });

    openGames.fetch(function(err) {
      var game = openGames.get()[0];
      if (game) {
        return page.redirect('/story/' + game.id);
      } else {
        promptList = prompts.get();
        id = model.id();
        var index = Math.floor(Math.random() * promptList.length);
        var promptText = promptList[index];
        game = model.at('stories').add({
          id: id,
          promptText: promptText,
          content: promptText
        });
        return page.redirect('/story/' + id);
      }
    });
  })
});

app.get('/story/:id', function(page, model, params, next) {
  var story = model.at('stories.' + params.id);
  var userId = model.get('_session.userId');
  story.subscribe(function(err) {
    if (err) return next(err);
    if (!story.get()) return page.redirect('/story');
    story.setNull('ready', {});
    story.setNull('users', []);

    if (story.get('users').indexOf(userId) < 0) {
      story.push('users', userId);
    }

    model.ref('_page.story', story); 

    page.render('story');
  });
});

app.get('/stories/:promptText', function(page, model, params, next) {
  model.set('_page.promptText', params.promptText);
  var stories = model.query('stories', {
    promptText: params.promptText,
    done: { $exists: true }
  });
  stories.subscribe(function(err) {
    if (err) return next(err);
    stories.ref('_page.stories');
    page.render('stories')
  })
});

function Timer(startTime, duration, onTick, done) {
  this.startTime = startTime;
  this.duration = duration;
  this.onTick = onTick
  this.done = done;
  this.interval = null;
}

Timer.prototype.start = function() {
  var timer = this;
  this.interval = setInterval(function() {
    timer.tick();
  }, 1000);
  this.tick();
}

Timer.prototype.tick = function() {
  var elapsed = new Date() - this.startTime;
  var remaining = this.duration - elapsed;
  this.onTick(remaining);
  if (remaining <= 0) {
    clearInterval(this.interval);
    this.interval = null;
    return this.done(+new Date());
  }
}

app.enter('/story/:id', function(model) {
  var timer;
  function checkStartTime () {
    var startTime = model.get('_page.story.startTime');
    //don't start our timer if we don't have a start time
    if (!startTime || timer) return;
  
    var duration = 10 * 1000;
    timer = new Timer(startTime, duration, onTick, done);
    
    function onTick(remaining) {
      var seconds = Math.round(remaining / 1000);
      var minutes = Math.round(seconds / 60);
      seconds %= 60;
      seconds = '' + seconds;
      while (seconds.length < 2) seconds = '0' + seconds;
      model.set('_page.clock', minutes + ':' + seconds);
    }
    function done(endTime) {
      model.set('_page.story.done', endTime);
      var promptText = encodeURI(model.get('_page.story.promptText'));
      app.history.push('/stories/' + promptText);
    }
    
    timer.start();
  }
  model.on('change', '_page.story.startTime', checkStartTime);
  checkStartTime();

  model.on('change', '_page.story.ready.*', function() {
    var story = model.get('_page.story');
    if (story.startTime) return;

    var players = [];
    for (var id in story.ready) {
      if (story.ready[id]) {
        players.push(id);

        if (players.length === 2) {
          // Modifying a remote document inside a model event callback for the same document is not allowed.
          // Notice that we are inside a model.on('change') callback for _page.story, and the following lines 
          // are settings paths on _page.story. We use setTimeout to get around this restriction.
          setTimeout(function() {
            model.set('_page.story.players', players);
            model.set('_page.story.startTime', +new Date());
          }, 0);
          return;
        }
      }
    }
  });
});

app.fn('startGame', function(e, el) {
  var userId = this.model.get('_session.userId');
  this.model.set('_page.story.ready.' + userId, true);
});
