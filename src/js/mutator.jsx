'use strict';

let mutatorFunction = (value) => value ;
const textarea = document.getElementById('mutatorscript');
let state = null;

window.addEventListener('message', function (event) {
    const {data} = event;
    let result = {
        success: false,
        state: state,
        id: data.id,
    }
    try{
        if(data.value && state) {
            result.value = mutatorFunction && mutatorFunction(data.value);
            result.success = true;
        }
    }catch(e){}

    event.source.postMessage(result, event.origin);
});

textarea.addEventListener('input', function() {
    this.classList.remove('is-invalid','is-valid');
    state = null;
});

textarea.addEventListener("change", function() {
    try{
        if(!this.value.length) {
            return;
        }
        if(this.value.indexOf('value') < 0) {
            throw new Error('This is not valid code');
        }
        const scriptString = `
            mutatorFunction = function (value,type) {
            ${this.value}
            return value;}
        `;
        eval(scriptString);
    
        if(typeof mutatorFunction === "function") {
            console.log("OK");
            this.classList.add('is-valid');
            state = true;
        } else {
            throw new Error('mutatorFunction must be a function');
        }
    }catch(e){
        this.classList.add('is-invalid');
        this.nextElementSibling.textContent = e.message;
        state = false;
    }
});