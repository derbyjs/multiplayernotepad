var app = require('derby').createApp(module)
  .use(require('../../ui'))

app.on('model', function(model) {
  model.on('change', '_page.story.ready.*', function() {
    var story = model.get('_page.story');
    console.log('onchange', story);
    if (story.startTime) return;

    var players = [];
    for (var id in story.ready) {
      if(story.ready[id]) {
        players.push(id);

        if (players.length === 2) {
          // Remove other players and start.
          setTimeout(function() {
            model.set('_page.story.players', players);
            model.set('_page.story.startTime', Date.now());
          }, 0);
          return;
        }
      }
    }

  });
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
      "There comes a time in every man's life when",
    ]);

    var openGames = model.query('stories', {
      $limit:1,
      users:{$size:1},
      startTime:{$exists:false}, done:{$exists:false}
    });

    openGames.fetch(function(err) {
      var game = openGames.get()[0];
      if(game) {
        return page.redirect('/story/' + game.id);
      } else {
        promptList = prompts.get();
        id = model.id();
        prmpt = promptList[Math.random() * promptList.length | 0];
        game = model.at('stories').add({
          id: id,
          'prompt': prmpt,
          content: prmpt
        })
        return page.redirect('/story/' + id);
      }
    });
  })
});

app.get('/story/:id', function(page, model, params, next) {
  var story = model.at('stories.' + params.id);
  var id = model.get('_session.userId');
  story.subscribe(function(err) {
    if (!story.get()) return page.redirect('/story');
    // Stories look like: {users:{}, content:'sadffdsa', ready:{'asdjkfhakhdf':true, 'sdffd':false}, startTime:123545}
    story.setNull('ready', {});
    story.setNull('users', []);

    if (story.get('users').indexOf(id) < 0)
      story.push('users', id);

    model.ref('_page.story', story);

    //model.start('makeUserList', '_page.userList', '_page.story.users', '_page.story.ready');
    //model.start('everybodyReady', '_page.story.startTime', '_page.story.users', '_page.story.ready');

    page.render('story');
  });
});

var clockInterval;
var startClock = function(model) {
  if (clockInterval) return;

  var startTime = model.get('_page.story.startTime');

  clockInterval = setInterval(function() {
    var elapsed = Date.now() - startTime;
    var remaining = 5 * 60 * 1000 - elapsed;
    //var remaining = 10 * 1000 - elapsed;

    if (remaining <= 0) {
      model.set('_page.story.done', Date.now());
      remaining = 0;

      app.history.push('/stories/' + encodeURI(model.get('_page.story.prompt')));
      clearInterval(clockInterval);
      return;
    }

    var secs = ((remaining / 1000) |0);
    var minutes = (secs / 60) |0;
    secs %= 60;

    secs = ''+secs;
    while (secs.length < 2) secs = '0'+secs;

    model.set('_page.clock', minutes + ':' + secs);
  }, 500);
};

app.enter('/story/:id', function(model) {
  var check;
  model.on('change', '_page.story.startTime', check = function() {
    var startTime = model.get('_page.story.startTime');
    if (!startTime) return;

    startClock(model);
  });
  check();
});


app.fn('startGame', function(e, el) {
  var id = this.model.get('_session.userId');
  this.model.set('_page.story.ready.' + id, true);
});

app.get('/', function(page) {
  page.redirect('/story');
});

app.get('/stories/:p', function(page, model, params, next) {
  model.set('_page.prompt', params['p']);
  var stories = model.query('stories', {
    'prompt': params['p'],
    done: { $exists: true }
  });
  stories.subscribe(function(err) {
    stories.ref('_page.stories');
    page.render('stories')
  })
});

