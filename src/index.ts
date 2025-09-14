import NcmConvertor from "./NcmConvertor";

export { NcmConvertor };
export default NcmConvertor;

if (typeof module === 'object' && module.exports) {
    module.exports = NcmConvertor;
    module.exports.default = NcmConvertor;
    module.exports.NcmConvertor = NcmConvertor;
}