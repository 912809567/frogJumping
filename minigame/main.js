const definition = require('../pages/index/index');
const { launch } = require('./runtime');
const host = typeof GameGlobal === 'undefined' ? {} : GameGlobal;
const animation = {
  requestAnimationFrame: callback => requestAnimationFrame(callback),
  cancelAnimationFrame: id => cancelAnimationFrame(id)
};
host.pondGame = launch(definition, wx, animation);
