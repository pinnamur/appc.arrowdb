var fs = require('fs'),
	path = require('path');

var schemaDir = path.resolve(path.join(__dirname, '..', '..', 'schema'));

/**
 * Fetches the schema for your connector.
 *
 * @param next
 * @returns {*}
 */
exports.fetchSchema = function (next) {
	if (this.schema) {
		return next(null, this.schema);
	}

	var objects = {};

	fs.readdirSync(schemaDir)
		.filter(function (file) {
			return file.slice(-3) === '.js';
		})
		.map(function (file) {
			try {
				return require(path.join(schemaDir, file));
			}
			catch (err) {
				console.error('Failed to Load ArrowDB Model ' + file + ':');
				console.error(err);
				return null;
			}
		})
		.filter(function (module) {
			return !!module;
		})
		.forEach(function (module) {
			objects[module.name] = module;
		});

	next(null, {
		objects: objects
	});
};
