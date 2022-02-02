(function (exports) {
    exports.T_CONNECTION_ESTABLISHED = "CONNECTION-ESTABLISHED";
    exports.O_CONNECTION_ESTABLISHED = {
        type: exports.T_CONNECTION_ESTABLISHED,
    };
    exports.S_CONNECTION_ESTABLISHED = JSON.stringify(exports.O_CONNECTION_ESTABLISHED);

    exports.T_MAKE_CODE = "MAKE-CODE";
    exports.O_MAKE_CODE = {
        type: exports.T_MAKE_CODE,
        code: null
    };

    exports.T_MAKE_GUESS = "MAKE-GUESS";
    exports.O_MAKE_GUESS = {
        type: exports.T_MAKE_GUESS,
        guess: null
    };

    exports.T_MAKE_EVAL = "MAKE-EVAL";
    exports.O_MAKE_EVAL = {
        type: exports.T_MAKE_EVAL,
        red: null,
        yellow: null
    };

    exports.T_GAME_ABORTED = "GAME-ABORTED";
    exports.O_GAME_ABORTED = {
        type: exports.T_GAME_ABORTED
    };
    exports.S_GAME_ABORTED = JSON.stringify(exports.O_GAME_ABORTED);

    exports.T_GAME_STATE = "GAME-STATE";
    exports.O_GAME_STATE = {
        type: exports.T_GAME_STATE,
        state: null
    };

    exports.T_GAME_INIT = "GAME-INIT";
    exports.O_GAME_INIT = {
        type: exports.T_GAME_INIT,
        game: null
    };

    exports.T_ERROR = "ERROR";
    exports.O_ERROR = {
        type: exports.T_ERROR,
        message: null
    };

    exports.T_REDIRECT = "REDIRECT";
    exports.O_REDIRECT = {
        type: exports.T_REDIRECT,
        message: null
    };

})(typeof exports === "undefined" ? (this.Messages = {}) : exports);
