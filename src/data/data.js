function isValidStateType(type) {
  return Object.values(StateType).includes(type);
}

const StateType = {
    ApiCall: "apiCall",
    OutroTipo: "outroTipo", 
  };

module.exports = {
  StateType,
  isValidStateType,
};
