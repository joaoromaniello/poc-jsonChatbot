function isValidStateType(type) {
  return Object.values(StateType).includes(type);
}

const StateType = {
  ApiCall: "apiCall",
  OutroTipo: "outroTipo", // Adicionei este tipo para exemplificar
};

module.exports = {
  StateType,
  isValidStateType,
};
