// Shared by the importer and highlighter. Keep capture groups compatible with EditLogImporter.
// The last account pair before optional #expression and the timestamp belongs to the account.
export const reEditLogHeader = /^([^\r\n]+?)(\(([^()\r\n]+)\)|（[^（）\r\n]+）|<[^<>\r\n]+>)?([^\S\r\n]*)(?:#([^\s\[]+))?([^\S\r\n]+)(\d{4}\/\d{1,2}\/\d{1,2} )?(\d{1,2}:\d{1,2}:\d{2})( #\d+)?(?: \[([^\]\r\n]+)\])?[^\S\r\n]*\r?$/m
