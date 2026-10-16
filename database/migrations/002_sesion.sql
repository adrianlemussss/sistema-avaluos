CREATE TABLE sesion (
  sid VARCHAR(128) NOT NULL PRIMARY KEY,
  datos TEXT NOT NULL,
  expira DATETIME NOT NULL,
  INDEX idx_sesion_expira (expira)
) ENGINE=InnoDB;
