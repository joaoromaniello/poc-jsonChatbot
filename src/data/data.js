function isValidStateType(type) {
    return Object.values(StateType).includes(type);
  }

const StateType = {
    ApiCall: "apiCall",
    conditional: "conditional",  
  };

  module.exports = {
    StateType,
    isValidStateType,
  };