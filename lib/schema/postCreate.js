var Arrow = require('arrow'),
	ArrowDB = require('arrowdb'),
	dbObjects = ArrowDB.getDBObjects();

/**
 * Wires up the built-in models and listens for any external models that
 * need to be wired up.
 */
exports.postCreate = function () {
	this.baseContext = this;
	var env = this.config.env || this.config.environment || 'production',
		key = this.config[env + '_key'] || this.config.key,
		opts = {
			apiEntryPoint: this.config[env + '_baseurl'] || this.config.baseurl || ''
		};

	this.baseDB = new ArrowDB(key, opts);

	this.on('init-model', function (Model) {

		// make sure the connector is initialized and that this model hasn't been initialized already
		if (this.models && (this.models[Model.name] && this.models[Model.name]._inited)) {
			return;
		}

		if (Model.objectName && dbObjects[Model.objectName]) {
			return this.wireModel(dbObjects[Model.objectName], Model, Model.objectName);
		}
		var CustomObjectModel = this.getModel('customObject');

		var parent = Model._supermodel;
		while (parent && parent._supermodel) {
			parent = parent._supermodel;
		}
		if (parent && parent.indexOf(this.name) === 0) {
			parent = this.getModel(parent);
			this.logger.trace('Wiring up inherited object: ' + Model.name + ' to parent: ' + parent.name);
			// We have extended a built in object.
			for (var key in parent) {
				if (parent.hasOwnProperty(key) && key[0] === '_') {
					Model[key] = parent[key];
				}
			}
			return;
		}

		this.logger.trace('Wiring up custom object: ' + Model.name);

		Model._instanceMethods = CustomObjectModel._instanceMethods;
		Model._isCustomObject = true;

		CustomObjectModel._methods.forEach(function (method, i, arr) {
			this.logger.trace((i + 1 < arr.length ? '├─ ' : '└─ ') + method + '()');
			Model[method] = CustomObjectModel[method].bind(Model);
		}, this);

		Model.instance = function instance(values, skipNotFound) {
			if (values.fields) {
				Object.keys(values.fields).forEach(function (key) {
					values[key] = values.fields[key];
				});
			}
			delete values.fields;
			return new Arrow.Instance(this, values, skipNotFound);
		};

		Model._prepareParams = function (method, instance, params, defaultValue) {
			params || (params = {});

			var id = instance instanceof Arrow.Instance ? instance.getPrimaryKey() : Array.isArray(params) ? params.join(',') : typeof params === 'string' ? params : null;

			var properties = {
				classname: Model.name,
				tags: params.tags,
				acl_name: params.acl_name,
				acl_id: params.acl_id,
				photo: params.photo,
				photo_id: params.photo_id,
				su_id: params.su_id,
			};

			Object.keys(properties).forEach(function (key) {
				delete params[key];
			});

			switch (method) {
				case 'create':
					properties.fields = params;
					return properties;
				case 'update':
					properties.id = id;
					properties.fields = instance.values(true);
					return properties;
				case 'delete':
					return {
						classname: Model.name,
						ids: id
					};
				case 'show':
					return {
						classname: Model.name,
						id: id
					};
			}

			params.classname = Model.name;
			return params;
		};

		Model._getResponseModelName = function () {
			return Model.name;
		};

		this.models[Model.name] = Model;
	}.bind(this));
};