/**
 * A simple knockout binding that integrates with knockout's select support.
 * Version: 0.1
 * License: MIT
 * Author: MrTrick
 * https://github.com/MrTrick/knockout-selectize
 */

 (function(factory) {
  if (typeof define === 'function' && define.amd) {
    define(['knockout', 'selectize'], factory);
  } else if (typeof exports === 'object' && typeof module === 'object') {
    module.exports = factory;
  } else {
    factory(ko);
  }
})(function(ko) {
  ko.bindingHandlers.selectize = {
    init: function (el, bindingValue, bindings, vm, context) {
      bindingValue = bindingValue();
      var params = ko.unwrap(bindingValue);
      if (!params.valueField) params.valueField = 'value';
      if (!params.labelField) params.labelField = 'text';

      var $el = $(el);
      if (!$el.is('select')) throw new Error('The selectize knockout binding is only valid on <select> elements. (because of the options binding)');
      $el.selectize(params);
      var selectize = el.selectize;

      //What options are being given?
      var options = bindings.get('options');
      var optionsSubscription = false;
      //If the options are observable, synchronise add/remove events between selectize and knockout
      if (ko.isObservable(options)) {
        var changing = false;

        //Whenever an option is added/removed, copy to the observable.
        selectize.on('option_add', function(value, data) { if (!changing) options.push(value); } );
        selectize.on('option_remove', function(value) { if (!changing) options.remove(value); } );

        //Whenever the observable has an element added/removed, copy to the options
        optionsSubscription = options.subscribe(function(changes) {
          changing = true;
          changes.forEach(function(change) {
            if (change.status === 'added') {
              option = {};
              option[params.labelField] = change.value;
              option[params.valueField] = change.value;
              selectize.addOption(option);
            } else if (change.status === 'deleted') {
              selectize.removeOption(change.value);
            }
          });
          changing = false;
        }, null, 'arrayChange');
      }

      //What is the input's value?
      var value = bindings.get('value');
      var valueSubscription = false;
      //If the value is observable, synchronise
      if (ko.isObservable(value)) {
        valueSubscription = value.subscribe(function(value) {
          //If the observable value doesn't match the element value, update the element;
          if (value !== selectize.getValue()) {
            if (typeof selectize.loadOption === "function") { selectize.loadOption(value); }
            else { selectize.setValue(value); }
          }
        });
      }

      //Selectize bug; doesn't disable the control input if the parent is disabled, even at startup. Fix. (after startup, handled by the observer ahead)
      if (selectize.$input.is(':disabled')) selectize.$control_input.prop('disabled', true);

      //For knockout bindings to work, we need to observe when the attributes of the <select> element are changed - `required`, `disabled`.
      //This is to update the selectize control to match the <select> element
      //(NOTE: `visible` should not be bound directly to <select>. Bind `visible` to an enclosing <div> or similar.)
      var observer = new MutationObserver(function(mutations) {
        var disabled = selectize.$input.is(':disabled'),
        required = selectize.$input.is(':required');

        //Check disabled
        //(The mutation may fire multiple times, so fence against loops)
        if (disabled !== selectize.isDisabled) {
          //Disable/enable selectize to match the real select element
          selectize[disabled ? 'disable' : 'enable']();

          //When the real element is disabled, disable the control input too.
          //This is a selectize bug - #307
          selectize.$control_input.prop('disabled', disabled);
        }

        //Check required
        //(The mutation may fire multiple times, so fence against loops)
        if (required !== selectize.isRequired) {
          selectize.isRequired = required;
          selectize.refreshState();
        }
      });
      observer.observe(el, {attributes:true});

      //When the dom node is removed, ensure that the selectize node is too, as well as the mutation observer
      ko.utils.domNodeDisposal.addDisposeCallback(el, function() {
        selectize.destroy();
        observer.disconnect();
        if (optionsSubscription) optionsSubscription.dispose();
        if (valueSubscription) valueSubscription.dispose();
      });
    }
  };
});