class Log {
  static LOG_PATH =
    "/home/daniwalter001/Projects/Perso/moe_catalog/data/logs.txt";
  static log = (level = "D", content = "") => {
    let log = `${new Date()
      .toISOString()
      .replace("T", " ")
      .substring(0, 19)}:${level}: ${content?.toString()}\n`;
    require("fs").writeFileSync(this.LOG_PATH, log, { flag: "a" });
  };

  static error = (content = "") => {
    this.log("E", content);
  };

  static debug = (content = "") => {
    this.log("D", content);
  };

  static warning = (content = "") => {
    this.log("W", content);
  };

  static info = (content = "") => {
    this.log("I", content);
  };
}

module.exports = { Log };
