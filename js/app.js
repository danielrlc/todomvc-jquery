/*global jQuery, Handlebars, Router */
jQuery(function ($) {
  'use strict';

  Handlebars.registerHelper('eq', function (a, b, options) {
    return a === b ? options.fn(this) : options.inverse(this);
  });

  var ENTER_KEY = 13;
  var ESCAPE_KEY = 27;

  var util = {
    uuid: function () {
      /*jshint bitwise:false */
      var i, random;
      var uuid = '';

      for (i = 0; i < 32; i++) {
        random = (Math.random() * 16) | 0;
        if (i === 8 || i === 12 || i === 16 || i === 20) {
          uuid += '-';
        }
        uuid += (i === 12 ? 4 : i === 16 ? (random & 3) | 8 : random).toString(
          16,
        );
      }

      return uuid;
    },
    pluralize: function (count, word) {
      return count === 1 ? word : word + 's';
    },

    // store sets the localStorage if it has a data argument passed to it
    // store gets the localStorage if it doesn't have a data argument passed to it
    store: function (namespace, data) {
      if (arguments.length > 1) {
        // You have to stringify data to store it in localStorage
        return localStorage.setItem(namespace, JSON.stringify(data));
      } else {
        var store = localStorage.getItem(namespace);
        // You have to parse (unstringify) the data to get it from localStorage
        return (store && JSON.parse(store)) || [];
      }
    },
  };

  var App = {
    init: function () {
      this.todos = util.store('todos-jquery');
      // ??? this.todoTemplate gets passed an argument. But how is that shown here?
      this.todoTemplate = Handlebars.compile($('#todo-template').html());
      this.footerTemplate = Handlebars.compile($('#footer-template').html());
      this.bindEvents();

      new Router({
        '/:filter': function (filter) {
          this.filter = filter;
          this.render();
        }.bind(this),
      }).init('/all');
    },
    // this has to be bound all over the place. That's all kept organised here.
    // But why is it necessary?
    // Because these are all callbacks.
    // So when the callbacks are actually called, 'this' is set to the global context (window).
    bindEvents: function () {
      // On every key press, run the .create method
      $('.new-todo').on('keyup', this.create.bind(this));
      // Without the binding, 'this' is set to window when the callback is actually called.
      // $('.new-todo').on('keyup', this.create);
      $('.toggle-all').on('change', this.toggleAll.bind(this));
      $('.footer').on(
        'click',
        '.clear-completed',
        this.destroyCompleted.bind(this),
      );
      $('.todo-list')
        .on('change', '.toggle', this.toggle.bind(this))
        .on('dblclick', 'label', this.editingMode.bind(this))
        .on('keyup', '.edit', this.editKeyup.bind(this))
        .on('focusout', '.edit', this.update.bind(this))
        .on('click', '.destroy', this.destroy.bind(this));
    },
    render: function () {
      var todos = this.getFilteredTodos();
      // Handlebars handles creating this template.
      $('.todo-list').html(this.todoTemplate(todos));
      // This follows the spec by hiding the .main section
      // if there are no todos to display.
      // The jQuery docs https://api.jquery.com/toggle/
      // say .toggle can take a 'display' boolean argument, as here.
      // Docs: 'Use true to show the element or false to hide it.'
      $('.main').toggle(todos.length > 0);
      // The 'checked' property is applied to '.toggle-all', if there are no active todos.
      $('.toggle-all').prop('checked', this.getActiveTodos().length === 0);
      this.renderFooter();
      // This autofocuses the new-todo input field.
      $('.new-todo').focus();
      // This is setting/updating the value of store.
      util.store('todos-jquery', this.todos);
    },
    renderFooter: function () {
      var todoCount = this.todos.length;
      var activeTodoCount = this.getActiveTodos().length;
      var template = this.footerTemplate({
        activeTodoCount: activeTodoCount,
        activeTodoWord: util.pluralize(activeTodoCount, 'item'),
        completedTodos: todoCount - activeTodoCount,
        filter: this.filter,
      });

      $('.footer')
        .toggle(todoCount > 0)
        .html(template);
    },
    toggleAll: function (e) {
      var isChecked = $(e.target).prop('checked');

      this.todos.forEach(function (todo) {
        todo.completed = isChecked;
      });

      this.render();
    },
    getActiveTodos: function () {
      return this.todos.filter(function (todo) {
        return !todo.completed;
      });
    },
    getCompletedTodos: function () {
      return this.todos.filter(function (todo) {
        return todo.completed;
      });
    },
    getFilteredTodos: function () {
      if (this.filter === 'active') {
        return this.getActiveTodos();
      }

      if (this.filter === 'completed') {
        return this.getCompletedTodos();
      }

      return this.todos;
    },
    destroyCompleted: function () {
      this.todos = this.getActiveTodos();
      this.render();
    },
    // accepts an element from inside the `.item` div and
    // returns the corresponding index in the `todos` array
    getIndexFromEl: function (el) {
      var id = $(el).closest('li').data('id');
      var todos = this.todos;
      var i = todos.length;

      while (i--) {
        if (todos[i].id === id) {
          return i;
        }
      }
    },
    create: function (e) {
      // The $ in $input is a jQuery naming convention.
      var $input = $(e.target);
      // Remove whitespace from the beginning and end of the input field.
      var val = $input.val().trim();

      // Don't do anything if the enter key wasn't pressed.
      // Or if the input field is empty.
      if (e.which !== ENTER_KEY || !val) {
        return;
      }

      this.todos.push({
        id: util.uuid(),
        title: val,
        completed: false,
      });

      $input.val('');

      this.render();
    },
    toggle: function (e) {
      var i = this.getIndexFromEl(e.target);
      this.todos[i].completed = !this.todos[i].completed;
      this.render();
    },
    editingMode: function (e) {
      var $input = $(e.target).closest('li').addClass('editing').find('.edit');
      // puts caret at end of input
      var tmpStr = $input.val();
      $input.val('');
      $input.val(tmpStr);
      $input.focus();
    },
    editKeyup: function (e) {
      if (e.which === ENTER_KEY) {
        e.target.blur();
      }

      if (e.which === ESCAPE_KEY) {
        $(e.target).data('abort', true).blur();
      }
    },
    update: function (e) {
      var el = e.target;
      var $el = $(el);
      var val = $el.val().trim();

      if ($el.data('abort')) {
        $el.data('abort', false);
      } else if (!val) {
        this.destroy(e);
        return;
      } else {
        this.todos[this.getIndexFromEl(el)].title = val;
      }

      this.render();
    },
    destroy: function (e) {
      this.todos.splice(this.getIndexFromEl(e.target), 1);
      this.render();
    },
  };

  App.init();
});
