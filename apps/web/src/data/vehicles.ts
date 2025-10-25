export type VehicleModel = {
  name: string;
  yearStart: number;
  yearEnd: number | null;
  bodyType: string;
  country: string;
};

export const VEHICLE_DATA = {
  "Acura": [
    {
      "name": "NSX",
      "yearStart": 1990,
      "yearEnd": null,
      "bodyType": "спортивный автомобиль",
      "country": "Япония"
    },
    {
      "name": "MDX",
      "yearStart": 2001,
      "yearEnd": null,
      "bodyType": "полноразмерный внедорожник",
      "country": "Япония"
    },
    {
      "name": "TLX",
      "yearStart": 2004,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Япония"
    },
    {
      "name": "RDX",
      "yearStart": 2006,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Япония"
    }
  ],
  "Alfa Romeo": [
    {
      "name": "Giulia",
      "yearStart": 2015,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Италия"
    },
    {
      "name": "Stelvio",
      "yearStart": 2017,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Италия"
    }
  ],
  "Aston Martin": [
    {
      "name": "DB11",
      "yearStart": 2016,
      "yearEnd": null,
      "bodyType": "спортивный автомобиль",
      "country": "Великобритания"
    },
    {
      "name": "DBX",
      "yearStart": 2019,
      "yearEnd": null,
      "bodyType": "полноразмерный внедорожник",
      "country": "Великобритания"
    }
  ],
  "Audi": [
    {
      "name": "A4",
      "yearStart": 1994,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Германия"
    },
    {
      "name": "A6",
      "yearStart": 1994,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Германия"
    },
    {
      "name": "A8",
      "yearStart": 1994,
      "yearEnd": null,
      "bodyType": "представительский седан",
      "country": "Германия"
    },
    {
      "name": "A3",
      "yearStart": 1996,
      "yearEnd": null,
      "bodyType": "компактный автомобиль",
      "country": "Германия"
    },
    {
      "name": "TT",
      "yearStart": 1998,
      "yearEnd": null,
      "bodyType": "купе/родстер",
      "country": "Германия"
    },
    {
      "name": "Q7",
      "yearStart": 2005,
      "yearEnd": null,
      "bodyType": "полноразмерный внедорожник",
      "country": "Германия"
    },
    {
      "name": "R8",
      "yearStart": 2006,
      "yearEnd": null,
      "bodyType": "спортивный автомобиль",
      "country": "Германия"
    },
    {
      "name": "A5",
      "yearStart": 2007,
      "yearEnd": null,
      "bodyType": "купе/седан",
      "country": "Германия"
    },
    {
      "name": "Q5",
      "yearStart": 2008,
      "yearEnd": null,
      "bodyType": "среднеразмерный внедорожник",
      "country": "Германия"
    },
    {
      "name": "A1",
      "yearStart": 2010,
      "yearEnd": null,
      "bodyType": "компактный автомобиль",
      "country": "Германия"
    },
    {
      "name": "A7",
      "yearStart": 2010,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Германия"
    },
    {
      "name": "Q3",
      "yearStart": 2011,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Германия"
    },
    {
      "name": "Q2",
      "yearStart": 2016,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Германия"
    },
    {
      "name": "e-tron (Q8 e tron)",
      "yearStart": 2018,
      "yearEnd": null,
      "bodyType": "полноразмерный внедорожник",
      "country": "Германия"
    },
    {
      "name": "Q8",
      "yearStart": 2018,
      "yearEnd": null,
      "bodyType": "полноразмерный внедорожник",
      "country": "Германия"
    },
    {
      "name": "e-tron GT",
      "yearStart": 2021,
      "yearEnd": null,
      "bodyType": "спортивный автомобиль",
      "country": "Германия"
    },
    {
      "name": "Q4",
      "yearStart": 2021,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Германия"
    }
  ],
  "Bentley": [
    {
      "name": "Continental",
      "yearStart": 2003,
      "yearEnd": null,
      "bodyType": "представительский седан",
      "country": "Великобритания"
    },
    {
      "name": "Flying Spur",
      "yearStart": 2005,
      "yearEnd": null,
      "bodyType": "представительский седан",
      "country": "Великобритания"
    },
    {
      "name": "Bentayga",
      "yearStart": 2015,
      "yearEnd": null,
      "bodyType": "полноразмерный внедорожник",
      "country": "Великобритания"
    }
  ],
  "BMW": [
    {
      "name": "5 Series",
      "yearStart": 1972,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Германия"
    },
    {
      "name": "3 Series",
      "yearStart": 1975,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Германия"
    },
    {
      "name": "6 Series",
      "yearStart": 1976,
      "yearEnd": null,
      "bodyType": "купе/кабриолет",
      "country": "Германия"
    },
    {
      "name": "7 Series",
      "yearStart": 1977,
      "yearEnd": null,
      "bodyType": "представительский седан",
      "country": "Германия"
    },
    {
      "name": "8 Series",
      "yearStart": 1989,
      "yearEnd": null,
      "bodyType": "люксовое купе",
      "country": "Германия"
    },
    {
      "name": "X5",
      "yearStart": 1999,
      "yearEnd": null,
      "bodyType": "полноразмерный внедорожник",
      "country": "Германия"
    },
    {
      "name": "Z4",
      "yearStart": 2002,
      "yearEnd": null,
      "bodyType": "родстер",
      "country": "Германия"
    },
    {
      "name": "X3",
      "yearStart": 2003,
      "yearEnd": null,
      "bodyType": "среднеразмерный внедорожник",
      "country": "Германия"
    },
    {
      "name": "1 Series",
      "yearStart": 2004,
      "yearEnd": null,
      "bodyType": "компактный автомобиль",
      "country": "Германия"
    },
    {
      "name": "X6",
      "yearStart": 2008,
      "yearEnd": null,
      "bodyType": "полноразмерный внедорожник",
      "country": "Германия"
    },
    {
      "name": "X1",
      "yearStart": 2009,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Германия"
    },
    {
      "name": "4 Series",
      "yearStart": 2013,
      "yearEnd": null,
      "bodyType": "купе/седан",
      "country": "Германия"
    },
    {
      "name": "i3",
      "yearStart": 2013,
      "yearEnd": null,
      "bodyType": "компактный автомобиль",
      "country": "Германия"
    },
    {
      "name": "2 Series",
      "yearStart": 2014,
      "yearEnd": null,
      "bodyType": "компактный автомобиль",
      "country": "Германия"
    },
    {
      "name": "i8",
      "yearStart": 2014,
      "yearEnd": null,
      "bodyType": "спортивный автомобиль",
      "country": "Германия"
    },
    {
      "name": "X4",
      "yearStart": 2014,
      "yearEnd": null,
      "bodyType": "среднеразмерный внедорожник",
      "country": "Германия"
    },
    {
      "name": "X2",
      "yearStart": 2018,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Германия"
    },
    {
      "name": "X7",
      "yearStart": 2019,
      "yearEnd": null,
      "bodyType": "полноразмерный внедорожник",
      "country": "Германия"
    },
    {
      "name": "i7",
      "yearStart": 2021,
      "yearEnd": null,
      "bodyType": "представительский седан",
      "country": "Германия"
    }
  ],
  "Bugatti": [
    {
      "name": "Chiron",
      "yearStart": 2016,
      "yearEnd": null,
      "bodyType": "спортивный автомобиль",
      "country": "Франция"
    }
  ],
  "BYD": [
    {
      "name": "Song",
      "yearStart": 2008,
      "yearEnd": null,
      "bodyType": "внедорожник",
      "country": "Китай"
    },
    {
      "name": "Qin",
      "yearStart": 2010,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Китай"
    },
    {
      "name": "DM-i",
      "yearStart": 2020,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Китай"
    },
    {
      "name": "Song DM-i Sedan",
      "yearStart": 2020,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Китай"
    },
    {
      "name": "Atto 3",
      "yearStart": 2021,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Китай"
    },
    {
      "name": "Song MAX DM-i",
      "yearStart": 2021,
      "yearEnd": null,
      "bodyType": "минивэн",
      "country": "Китай"
    },
    {
      "name": "Yuan Plus",
      "yearStart": 2021,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Китай"
    },
    {
      "name": "Seagull",
      "yearStart": 2023,
      "yearEnd": null,
      "bodyType": "компактный автомобиль",
      "country": "Китай"
    }
  ],
  "Cadillac": [
    {
      "name": "Escalade",
      "yearStart": 2002,
      "yearEnd": null,
      "bodyType": "полноразмерный внедорожник",
      "country": "США"
    }
  ],
  "Caterham": [
    {
      "name": "Seven",
      "yearStart": 1973,
      "yearEnd": null,
      "bodyType": "спортивный автомобиль",
      "country": "Великобритания"
    }
  ],
  "Changan": [
    {
      "name": "CS35",
      "yearStart": 2012,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Китай"
    },
    {
      "name": "CS75",
      "yearStart": 2014,
      "yearEnd": null,
      "bodyType": "среднеразмерный внедорожник",
      "country": "Китай"
    },
    {
      "name": "Eado",
      "yearStart": 2015,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Китай"
    }
  ],
  "Chery": [
    {
      "name": "QQ",
      "yearStart": 2003,
      "yearEnd": null,
      "bodyType": "компактный автомобиль",
      "country": "Китай"
    },
    {
      "name": "Tiggo",
      "yearStart": 2006,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Китай"
    }
  ],
  "Chevrolet": [
    {
      "name": "Corvette",
      "yearStart": 1953,
      "yearEnd": null,
      "bodyType": "спортивный автомобиль",
      "country": "США"
    },
    {
      "name": "Malibu",
      "yearStart": 1964,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "США"
    },
    {
      "name": "Camaro",
      "yearStart": 1966,
      "yearEnd": null,
      "bodyType": "спортивный автомобиль",
      "country": "США"
    },
    {
      "name": "Equinox",
      "yearStart": 2004,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "США"
    }
  ],
  "Chrysler": [
    {
      "name": "PT Cruiser",
      "yearStart": 2000,
      "yearEnd": null,
      "bodyType": "компактный автомобиль",
      "country": "США"
    },
    {
      "name": "Crossfire",
      "yearStart": 2003,
      "yearEnd": null,
      "bodyType": "спортивный автомобиль",
      "country": "США"
    },
    {
      "name": "300",
      "yearStart": 2004,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "США"
    },
    {
      "name": "Pacifica",
      "yearStart": 2016,
      "yearEnd": null,
      "bodyType": "минивэн",
      "country": "США"
    }
  ],
  "Citroen": [
    {
      "name": "C5",
      "yearStart": 2000,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Франция"
    },
    {
      "name": "C3",
      "yearStart": 2002,
      "yearEnd": null,
      "bodyType": "компактный автомобиль",
      "country": "Франция"
    },
    {
      "name": "C4",
      "yearStart": 2004,
      "yearEnd": null,
      "bodyType": "хэтчбек",
      "country": "Франция"
    },
    {
      "name": "C1",
      "yearStart": 2005,
      "yearEnd": null,
      "bodyType": "компактный автомобиль",
      "country": "Франция"
    }
  ],
  "Cupra": [
    {
      "name": "Ateca (Cupra Ateca)",
      "yearStart": 2018,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Испания"
    },
    {
      "name": "Formentor",
      "yearStart": 2020,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Испания"
    },
    {
      "name": "Leon (Cupra Leon)",
      "yearStart": 2020,
      "yearEnd": null,
      "bodyType": "хэтчбек",
      "country": "Испания"
    }
  ],
  "Dacia": [
    {
      "name": "Logan",
      "yearStart": 2004,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Румыния"
    },
    {
      "name": "Sandero",
      "yearStart": 2007,
      "yearEnd": null,
      "bodyType": "хэтчбек",
      "country": "Румыния"
    },
    {
      "name": "Duster",
      "yearStart": 2009,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Румыния"
    }
  ],
  "Dodge": [
    {
      "name": "Charger",
      "yearStart": 1966,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "США"
    },
    {
      "name": "Challenger",
      "yearStart": 1970,
      "yearEnd": null,
      "bodyType": "спортивный автомобиль",
      "country": "США"
    },
    {
      "name": "Grand Caravan",
      "yearStart": 1984,
      "yearEnd": null,
      "bodyType": "минивэн",
      "country": "США"
    },
    {
      "name": "Viper",
      "yearStart": 1992,
      "yearEnd": null,
      "bodyType": "спортивный автомобиль",
      "country": "США"
    },
    {
      "name": "Durango",
      "yearStart": 1998,
      "yearEnd": null,
      "bodyType": "среднеразмерный внедорожник",
      "country": "США"
    },
    {
      "name": "Journey",
      "yearStart": 2008,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "США"
    }
  ],
  "Dongfeng": [
    {
      "name": "H30",
      "yearStart": 2014,
      "yearEnd": null,
      "bodyType": "хэтчбек",
      "country": "Китай"
    },
    {
      "name": "T5",
      "yearStart": 2017,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Китай"
    }
  ],
  "DS": [
    {
      "name": "DS3",
      "yearStart": 2010,
      "yearEnd": null,
      "bodyType": "компактный автомобиль",
      "country": "Франция"
    },
    {
      "name": "DS4",
      "yearStart": 2011,
      "yearEnd": null,
      "bodyType": "компактный автомобиль",
      "country": "Франция"
    },
    {
      "name": "DS7",
      "yearStart": 2017,
      "yearEnd": null,
      "bodyType": "среднеразмерный внедорожник",
      "country": "Франция"
    }
  ],
  "FAW": [
    {
      "name": "Besturn B50",
      "yearStart": 2012,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Китай"
    },
    {
      "name": "Besturn X40",
      "yearStart": 2016,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Китай"
    }
  ],
  "Ferrari": [
    {
      "name": "F8 Tributo",
      "yearStart": 2019,
      "yearEnd": null,
      "bodyType": "спортивный автомобиль",
      "country": "Италия"
    },
    {
      "name": "SF90 Stradale",
      "yearStart": 2019,
      "yearEnd": null,
      "bodyType": "спортивный автомобиль",
      "country": "Италия"
    }
  ],
  "Fiat": [
    {
      "name": "Panda",
      "yearStart": 1980,
      "yearEnd": null,
      "bodyType": "компактный автомобиль",
      "country": "Италия"
    },
    {
      "name": "Punto",
      "yearStart": 1993,
      "yearEnd": null,
      "bodyType": "компактный автомобиль",
      "country": "Италия"
    },
    {
      "name": "500",
      "yearStart": 2007,
      "yearEnd": null,
      "bodyType": "компактный автомобиль",
      "country": "Италия"
    }
  ],
  "Ford": [
    {
      "name": "F-150",
      "yearStart": 1948,
      "yearEnd": null,
      "bodyType": "пикап",
      "country": "США"
    },
    {
      "name": "Mustang",
      "yearStart": 1964,
      "yearEnd": null,
      "bodyType": "спортивный автомобиль",
      "country": "США"
    },
    {
      "name": "Transit",
      "yearStart": 1965,
      "yearEnd": null,
      "bodyType": "коммерческий фургон",
      "country": "США"
    },
    {
      "name": "Fiesta",
      "yearStart": 1976,
      "yearEnd": null,
      "bodyType": "компактный автомобиль",
      "country": "США"
    },
    {
      "name": "Mondeo",
      "yearStart": 1993,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "США"
    },
    {
      "name": "Focus",
      "yearStart": 1998,
      "yearEnd": null,
      "bodyType": "хэтчбек",
      "country": "США"
    },
    {
      "name": "Kuga",
      "yearStart": 2008,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "США"
    },
    {
      "name": "Transit Custom",
      "yearStart": 2012,
      "yearEnd": null,
      "bodyType": "коммерческий фургон",
      "country": "США"
    },
    {
      "name": "Explorer",
      "yearStart": 2020,
      "yearEnd": null,
      "bodyType": "среднеразмерный внедорожник",
      "country": "США"
    }
  ],
  "GAZ": [
    {
      "name": "Gazelle",
      "yearStart": 1994,
      "yearEnd": null,
      "bodyType": "легкий грузовик",
      "country": "Россия"
    },
    {
      "name": "Sobol",
      "yearStart": 1998,
      "yearEnd": null,
      "bodyType": "фургон",
      "country": "Россия"
    }
  ],
  "Geely": [
    {
      "name": "Emgrand",
      "yearStart": 2009,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Китай"
    },
    {
      "name": "GS",
      "yearStart": 2015,
      "yearEnd": null,
      "bodyType": "внедорожник",
      "country": "Китай"
    },
    {
      "name": "Boyue",
      "yearStart": 2016,
      "yearEnd": null,
      "bodyType": "среднеразмерный внедорожник",
      "country": "Китай"
    },
    {
      "name": "Coolray",
      "yearStart": 2018,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Китай"
    }
  ],
  "Genesis": [
    {
      "name": "G90",
      "yearStart": 2015,
      "yearEnd": null,
      "bodyType": "представительский седан",
      "country": "Южная Корея"
    },
    {
      "name": "G80",
      "yearStart": 2016,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Южная Корея"
    },
    {
      "name": "G70",
      "yearStart": 2017,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Южная Корея"
    },
    {
      "name": "GV70",
      "yearStart": 2020,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Южная Корея"
    },
    {
      "name": "GV80",
      "yearStart": 2020,
      "yearEnd": null,
      "bodyType": "среднеразмерный внедорожник",
      "country": "Южная Корея"
    }
  ],
  "Great Wall": [
    {
      "name": "Wingle",
      "yearStart": 2009,
      "yearEnd": null,
      "bodyType": "пикап",
      "country": "Китай"
    },
    {
      "name": "Haval H6",
      "yearStart": 2011,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Китай"
    },
    {
      "name": "Haval H9",
      "yearStart": 2014,
      "yearEnd": null,
      "bodyType": "полноразмерный внедорожник",
      "country": "Китай"
    }
  ],
  "Haval": [
    {
      "name": "F7",
      "yearStart": 2018,
      "yearEnd": null,
      "bodyType": "среднеразмерный внедорожник",
      "country": "Китай"
    },
    {
      "name": "F7X",
      "yearStart": 2019,
      "yearEnd": null,
      "bodyType": "купе/седан",
      "country": "Китай"
    }
  ],
  "Honda": [
    {
      "name": "Civic",
      "yearStart": 1972,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Япония"
    },
    {
      "name": "Accord",
      "yearStart": 1976,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Япония"
    },
    {
      "name": "CR-V",
      "yearStart": 1996,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Япония"
    },
    {
      "name": "Fit (Jazz)",
      "yearStart": 2001,
      "yearEnd": null,
      "bodyType": "компактный автомобиль",
      "country": "Япония"
    },
    {
      "name": "Pilot",
      "yearStart": 2002,
      "yearEnd": null,
      "bodyType": "полноразмерный внедорожник",
      "country": "Япония"
    }
  ],
  "Huanghai": [
    {
      "name": "N2",
      "yearStart": 2012,
      "yearEnd": null,
      "bodyType": "внедорожник",
      "country": "Китай"
    },
    {
      "name": "Utes",
      "yearStart": 2015,
      "yearEnd": null,
      "bodyType": "пикап",
      "country": "Китай"
    }
  ],
  "Hyundai": [
    {
      "name": "Sonata",
      "yearStart": 1985,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Южная Корея"
    },
    {
      "name": "Elantra",
      "yearStart": 1990,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Южная Корея"
    },
    {
      "name": "Santa Fe",
      "yearStart": 2000,
      "yearEnd": null,
      "bodyType": "среднеразмерный внедорожник",
      "country": "Южная Корея"
    },
    {
      "name": "Tucson",
      "yearStart": 2004,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Южная Корея"
    },
    {
      "name": "Kona",
      "yearStart": 2017,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Южная Корея"
    },
    {
      "name": "Palisade",
      "yearStart": 2018,
      "yearEnd": null,
      "bodyType": "полноразмерный внедорожник",
      "country": "Южная Корея"
    }
  ],
  "Infiniti": [
    {
      "name": "Q50",
      "yearStart": 2013,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Япония"
    },
    {
      "name": "Q60",
      "yearStart": 2013,
      "yearEnd": null,
      "bodyType": "спортивный автомобиль",
      "country": "Япония"
    },
    {
      "name": "QX50",
      "yearStart": 2013,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Япония"
    },
    {
      "name": "QX60",
      "yearStart": 2013,
      "yearEnd": null,
      "bodyType": "полноразмерный внедорожник",
      "country": "Япония"
    },
    {
      "name": "QX80",
      "yearStart": 2013,
      "yearEnd": null,
      "bodyType": "полноразмерный внедорожник",
      "country": "Япония"
    }
  ],
  "Isuzu": [
    {
      "name": "D-Max",
      "yearStart": 2002,
      "yearEnd": null,
      "bodyType": "пикап",
      "country": "Япония"
    },
    {
      "name": "MU-X",
      "yearStart": 2013,
      "yearEnd": null,
      "bodyType": "полноразмерный внедорожник",
      "country": "Япония"
    }
  ],
  "JAC": [
    {
      "name": "T6",
      "yearStart": 2014,
      "yearEnd": null,
      "bodyType": "пикап",
      "country": "Китай"
    },
    {
      "name": "S2",
      "yearStart": 2018,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Китай"
    }
  ],
  "Jaguar": [
    {
      "name": "XJ",
      "yearStart": 1968,
      "yearEnd": null,
      "bodyType": "представительский седан",
      "country": "Великобритания"
    },
    {
      "name": "XF",
      "yearStart": 2008,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Великобритания"
    },
    {
      "name": "F-Type",
      "yearStart": 2013,
      "yearEnd": null,
      "bodyType": "спортивный автомобиль",
      "country": "Великобритания"
    },
    {
      "name": "XE",
      "yearStart": 2015,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Великобритания"
    },
    {
      "name": "F-Pace",
      "yearStart": 2016,
      "yearEnd": null,
      "bodyType": "среднеразмерный внедорожник",
      "country": "Великобритания"
    },
    {
      "name": "E-Pace",
      "yearStart": 2017,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Великобритания"
    },
    {
      "name": "I-Pace",
      "yearStart": 2018,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Великобритания"
    }
  ],
  "Kamaz": [
    {
      "name": "4308",
      "yearStart": 1999,
      "yearEnd": null,
      "bodyType": "грузовик",
      "country": "Россия"
    },
    {
      "name": "6520",
      "yearStart": 2005,
      "yearEnd": null,
      "bodyType": "грузовик",
      "country": "Россия"
    }
  ],
  "Kia": [
    {
      "name": "Sportage",
      "yearStart": 1995,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Южная Корея"
    },
    {
      "name": "Rio",
      "yearStart": 1999,
      "yearEnd": null,
      "bodyType": "компактный автомобиль",
      "country": "Южная Корея"
    },
    {
      "name": "Optima",
      "yearStart": 2000,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Южная Корея"
    },
    {
      "name": "Sorento",
      "yearStart": 2002,
      "yearEnd": null,
      "bodyType": "среднеразмерный внедорожник",
      "country": "Южная Корея"
    },
    {
      "name": "Forte (Cerato)",
      "yearStart": 2009,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Южная Корея"
    },
    {
      "name": "Soul",
      "yearStart": 2009,
      "yearEnd": null,
      "bodyType": "субкомпактный кроссовер",
      "country": "Южная Корея"
    },
    {
      "name": "Niro",
      "yearStart": 2016,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Южная Корея"
    },
    {
      "name": "Seltos",
      "yearStart": 2019,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Южная Корея"
    },
    {
      "name": "Telluride",
      "yearStart": 2019,
      "yearEnd": null,
      "bodyType": "полноразмерный внедорожник",
      "country": "Южная Корея"
    }
  ],
  "Koenigsegg": [
    {
      "name": "Agera",
      "yearStart": 2011,
      "yearEnd": null,
      "bodyType": "спортивный автомобиль",
      "country": "Швеция"
    }
  ],
  "Lada": [
    {
      "name": "Niva",
      "yearStart": 1977,
      "yearEnd": null,
      "bodyType": "внедорожник",
      "country": "Россия"
    },
    {
      "name": "Priora",
      "yearStart": 2007,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Россия"
    },
    {
      "name": "Granta",
      "yearStart": 2011,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Россия"
    },
    {
      "name": "Largus",
      "yearStart": 2012,
      "yearEnd": null,
      "bodyType": "фургон",
      "country": "Россия"
    },
    {
      "name": "Vesta",
      "yearStart": 2015,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Россия"
    }
  ],
  "Land Rover": [
    {
      "name": "Range Rover",
      "yearStart": 1970,
      "yearEnd": null,
      "bodyType": "полноразмерный внедорожник",
      "country": "Великобритания"
    },
    {
      "name": "Defender",
      "yearStart": 1983,
      "yearEnd": null,
      "bodyType": "внедорожник",
      "country": "Великобритания"
    },
    {
      "name": "Discovery",
      "yearStart": 1989,
      "yearEnd": null,
      "bodyType": "полноразмерный внедорожник",
      "country": "Великобритания"
    },
    {
      "name": "Range Rover Sport",
      "yearStart": 2005,
      "yearEnd": null,
      "bodyType": "среднеразмерный внедорожник",
      "country": "Великобритания"
    },
    {
      "name": "Range Rover Evoque",
      "yearStart": 2011,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Великобритания"
    }
  ],
  "Lexus": [
    {
      "name": "ES",
      "yearStart": 1989,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Япония"
    },
    {
      "name": "LS",
      "yearStart": 1989,
      "yearEnd": null,
      "bodyType": "представительский седан",
      "country": "Япония"
    },
    {
      "name": "LX",
      "yearStart": 1996,
      "yearEnd": null,
      "bodyType": "полноразмерный внедорожник",
      "country": "Япония"
    },
    {
      "name": "RX",
      "yearStart": 1998,
      "yearEnd": null,
      "bodyType": "среднеразмерный внедорожник",
      "country": "Япония"
    },
    {
      "name": "IS",
      "yearStart": 1999,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Япония"
    },
    {
      "name": "GX",
      "yearStart": 2002,
      "yearEnd": null,
      "bodyType": "среднеразмерный внедорожник",
      "country": "Япония"
    },
    {
      "name": "NX",
      "yearStart": 2014,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Япония"
    }
  ],
  "Li Auto": [
    {
      "name": "Li ONE",
      "yearStart": 2019,
      "yearEnd": null,
      "bodyType": "полноразмерный внедорожник",
      "country": "Китай"
    },
    {
      "name": "Li MEGA",
      "yearStart": 2023,
      "yearEnd": null,
      "bodyType": "полноразмерный внедорожник",
      "country": "Китай"
    }
  ],
  "Lifan": [
    {
      "name": "520",
      "yearStart": 2007,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Китай"
    },
    {
      "name": "X60",
      "yearStart": 2012,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Китай"
    }
  ],
  "Lotus": [
    {
      "name": "Emira",
      "yearStart": 2021,
      "yearEnd": null,
      "bodyType": "спортивный автомобиль",
      "country": "Великобритания"
    },
    {
      "name": "Eletre",
      "yearStart": 2022,
      "yearEnd": null,
      "bodyType": "полноразмерный внедорожник",
      "country": "Великобритания"
    }
  ],
  "Maserati": [
    {
      "name": "Quattroporte",
      "yearStart": 1963,
      "yearEnd": null,
      "bodyType": "представительский седан",
      "country": "Италия"
    },
    {
      "name": "GranTurismo",
      "yearStart": 2007,
      "yearEnd": null,
      "bodyType": "спортивный автомобиль",
      "country": "Италия"
    },
    {
      "name": "Ghibli",
      "yearStart": 2013,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Италия"
    },
    {
      "name": "Levante",
      "yearStart": 2016,
      "yearEnd": null,
      "bodyType": "среднеразмерный внедорожник",
      "country": "Италия"
    },
    {
      "name": "MC20",
      "yearStart": 2020,
      "yearEnd": null,
      "bodyType": "спортивный автомобиль",
      "country": "Италия"
    }
  ],
  "Maybach": [
    {
      "name": "S580",
      "yearStart": 2021,
      "yearEnd": null,
      "bodyType": "представительский седан",
      "country": "Германия"
    }
  ],
  "Mazda": [
    {
      "name": "MX-5 (Miata)",
      "yearStart": 1989,
      "yearEnd": null,
      "bodyType": "родстер",
      "country": "Япония"
    },
    {
      "name": "Mazda2",
      "yearStart": 2002,
      "yearEnd": null,
      "bodyType": "компактный автомобиль",
      "country": "Япония"
    },
    {
      "name": "Mazda6",
      "yearStart": 2002,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Япония"
    },
    {
      "name": "Mazda3",
      "yearStart": 2003,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Япония"
    },
    {
      "name": "CX-9",
      "yearStart": 2006,
      "yearEnd": null,
      "bodyType": "полноразмерный внедорожник",
      "country": "Япония"
    },
    {
      "name": "CX-5",
      "yearStart": 2013,
      "yearEnd": null,
      "bodyType": "среднеразмерный внедорожник",
      "country": "Япония"
    },
    {
      "name": "CX-3",
      "yearStart": 2015,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Япония"
    },
    {
      "name": "CX-30",
      "yearStart": 2019,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Япония"
    }
  ],
  "McLaren": [
    {
      "name": "570S",
      "yearStart": 2015,
      "yearEnd": null,
      "bodyType": "спортивный автомобиль",
      "country": "Великобритания"
    },
    {
      "name": "GT",
      "yearStart": 2019,
      "yearEnd": null,
      "bodyType": "спортивный автомобиль",
      "country": "Великобритания"
    }
  ],
  "Mercedes-Benz": [
    {
      "name": "S-Class",
      "yearStart": 1954,
      "yearEnd": null,
      "bodyType": "представительский седан",
      "country": "Германия"
    },
    {
      "name": "G-Class",
      "yearStart": 1979,
      "yearEnd": null,
      "bodyType": "внедорожник",
      "country": "Германия"
    },
    {
      "name": "E-Class",
      "yearStart": 1984,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Германия"
    },
    {
      "name": "C-Class",
      "yearStart": 1993,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Германия"
    },
    {
      "name": "Sprinter",
      "yearStart": 1995,
      "yearEnd": null,
      "bodyType": "коммерческий фургон",
      "country": "Германия"
    },
    {
      "name": "Vito",
      "yearStart": 1996,
      "yearEnd": null,
      "bodyType": "коммерческий фургон",
      "country": "Германия"
    },
    {
      "name": "A-Class",
      "yearStart": 1997,
      "yearEnd": null,
      "bodyType": "компактный автомобиль",
      "country": "Германия"
    },
    {
      "name": "CLS",
      "yearStart": 2004,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Германия"
    },
    {
      "name": "B-Class",
      "yearStart": 2005,
      "yearEnd": null,
      "bodyType": "компактвэн",
      "country": "Германия"
    },
    {
      "name": "CLA",
      "yearStart": 2013,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Германия"
    },
    {
      "name": "GLA",
      "yearStart": 2013,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Германия"
    },
    {
      "name": "GLC",
      "yearStart": 2015,
      "yearEnd": null,
      "bodyType": "среднеразмерный внедорожник",
      "country": "Германия"
    },
    {
      "name": "GLE",
      "yearStart": 2015,
      "yearEnd": null,
      "bodyType": "полноразмерный внедорожник",
      "country": "Германия"
    },
    {
      "name": "GLB",
      "yearStart": 2019,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Германия"
    },
    {
      "name": "GLS",
      "yearStart": 2019,
      "yearEnd": null,
      "bodyType": "полноразмерный внедорожник",
      "country": "Германия"
    }
  ],
  "MG": [
    {
      "name": "MG6",
      "yearStart": 2010,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Великобритания"
    },
    {
      "name": "MG3",
      "yearStart": 2011,
      "yearEnd": null,
      "bodyType": "компактный автомобиль",
      "country": "Великобритания"
    },
    {
      "name": "ZS",
      "yearStart": 2017,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Великобритания"
    },
    {
      "name": "HS",
      "yearStart": 2018,
      "yearEnd": null,
      "bodyType": "среднеразмерный внедорожник",
      "country": "Великобритания"
    },
    {
      "name": "MG5",
      "yearStart": 2021,
      "yearEnd": null,
      "bodyType": "компактный автомобиль",
      "country": "Великобритания"
    }
  ],
  "Mini": [
    {
      "name": "Hatch (Cooper)",
      "yearStart": 2001,
      "yearEnd": null,
      "bodyType": "хэтчбек",
      "country": "Великобритания"
    },
    {
      "name": "Clubman",
      "yearStart": 2007,
      "yearEnd": null,
      "bodyType": "универсал",
      "country": "Великобритания"
    },
    {
      "name": "Countryman",
      "yearStart": 2010,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Великобритания"
    }
  ],
  "Mitsubishi": [
    {
      "name": "Lancer",
      "yearStart": 1973,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Япония"
    },
    {
      "name": "Mirage",
      "yearStart": 1978,
      "yearEnd": null,
      "bodyType": "компактный автомобиль",
      "country": "Япония"
    },
    {
      "name": "Pajero (Montero)",
      "yearStart": 1982,
      "yearEnd": null,
      "bodyType": "полноразмерный внедорожник",
      "country": "Япония"
    },
    {
      "name": "Outlander",
      "yearStart": 2003,
      "yearEnd": null,
      "bodyType": "среднеразмерный внедорожник",
      "country": "Япония"
    },
    {
      "name": "ASX (Outlander Sport)",
      "yearStart": 2010,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Япония"
    },
    {
      "name": "Eclipse Cross",
      "yearStart": 2017,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Япония"
    }
  ],
  "Morgan": [
    {
      "name": "4/4",
      "yearStart": 1936,
      "yearEnd": null,
      "bodyType": "родстер",
      "country": "Великобритания"
    },
    {
      "name": "Plus Six",
      "yearStart": 2019,
      "yearEnd": null,
      "bodyType": "спортивный автомобиль",
      "country": "Великобритания"
    }
  ],
  "Moskvitch": [
    {
      "name": "2141 (Aleko)",
      "yearStart": 1986,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Россия"
    },
    {
      "name": "3",
      "yearStart": 1994,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Россия"
    }
  ],
  "NIO": [
    {
      "name": "ES6",
      "yearStart": 2018,
      "yearEnd": null,
      "bodyType": "среднеразмерный внедорожник",
      "country": "Китай"
    },
    {
      "name": "ES8",
      "yearStart": 2018,
      "yearEnd": null,
      "bodyType": "полноразмерный внедорожник",
      "country": "Китай"
    },
    {
      "name": "ET6",
      "yearStart": 2023,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Китай"
    }
  ],
  "Nissan": [
    {
      "name": "Maxima",
      "yearStart": 1981,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Япония"
    },
    {
      "name": "Pathfinder",
      "yearStart": 1986,
      "yearEnd": null,
      "bodyType": "полноразмерный внедорожник",
      "country": "Япония"
    },
    {
      "name": "Altima (Teana)",
      "yearStart": 1992,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Япония"
    },
    {
      "name": "Navara (Frontier)",
      "yearStart": 1997,
      "yearEnd": null,
      "bodyType": "пикап",
      "country": "Япония"
    },
    {
      "name": "Qashqai",
      "yearStart": 2006,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Япония"
    },
    {
      "name": "GT-R",
      "yearStart": 2007,
      "yearEnd": null,
      "bodyType": "спортивный автомобиль",
      "country": "Япония"
    },
    {
      "name": "Rogue (X-Trail)",
      "yearStart": 2007,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Япония"
    },
    {
      "name": "Leaf",
      "yearStart": 2010,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Япония"
    }
  ],
  "Opel": [
    {
      "name": "Corsa",
      "yearStart": 1982,
      "yearEnd": null,
      "bodyType": "компактный автомобиль",
      "country": "Германия"
    },
    {
      "name": "Vectra",
      "yearStart": 1988,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Германия"
    },
    {
      "name": "Astra",
      "yearStart": 1991,
      "yearEnd": null,
      "bodyType": "хэтчбек",
      "country": "Германия"
    },
    {
      "name": "Zafira",
      "yearStart": 1999,
      "yearEnd": null,
      "bodyType": "минивэн",
      "country": "Германия"
    },
    {
      "name": "Insignia",
      "yearStart": 2008,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Германия"
    },
    {
      "name": "Mokka",
      "yearStart": 2012,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Германия"
    },
    {
      "name": "Crossland",
      "yearStart": 2017,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Германия"
    },
    {
      "name": "Grandland",
      "yearStart": 2017,
      "yearEnd": null,
      "bodyType": "среднеразмерный внедорожник",
      "country": "Германия"
    }
  ],
  "Pagani": [
    {
      "name": "Huayra",
      "yearStart": 2011,
      "yearEnd": null,
      "bodyType": "спортивный автомобиль",
      "country": "Италия"
    }
  ],
  "Peugeot": [
    {
      "name": "Boxer",
      "yearStart": 1994,
      "yearEnd": null,
      "bodyType": "коммерческий фургон",
      "country": "Франция"
    },
    {
      "name": "3008",
      "yearStart": 2009,
      "yearEnd": null,
      "bodyType": "среднеразмерный внедорожник",
      "country": "Франция"
    },
    {
      "name": "5008",
      "yearStart": 2009,
      "yearEnd": null,
      "bodyType": "полноразмерный внедорожник",
      "country": "Франция"
    },
    {
      "name": "508",
      "yearStart": 2011,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Франция"
    },
    {
      "name": "208",
      "yearStart": 2012,
      "yearEnd": null,
      "bodyType": "компактный автомобиль",
      "country": "Франция"
    },
    {
      "name": "308",
      "yearStart": 2013,
      "yearEnd": null,
      "bodyType": "хэтчбек",
      "country": "Франция"
    }
  ],
  "Polestar": [
    {
      "name": "2",
      "yearStart": 2019,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Швеция"
    },
    {
      "name": "1",
      "yearStart": 2021,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Швеция"
    },
    {
      "name": "3",
      "yearStart": 2023,
      "yearEnd": null,
      "bodyType": "среднеразмерный внедорожник",
      "country": "Швеция"
    }
  ],
  "Porsche": [
    {
      "name": "911",
      "yearStart": 1963,
      "yearEnd": null,
      "bodyType": "спортивный автомобиль",
      "country": "Германия"
    },
    {
      "name": "Cayenne",
      "yearStart": 2002,
      "yearEnd": null,
      "bodyType": "полноразмерный внедорожник",
      "country": "Германия"
    },
    {
      "name": "Panamera",
      "yearStart": 2009,
      "yearEnd": null,
      "bodyType": "представительский седан",
      "country": "Германия"
    },
    {
      "name": "Taycan",
      "yearStart": 2019,
      "yearEnd": null,
      "bodyType": "спортивный автомобиль",
      "country": "Германия"
    }
  ],
  "Ram": [
    {
      "name": "1500",
      "yearStart": 1981,
      "yearEnd": null,
      "bodyType": "пикап",
      "country": "США"
    },
    {
      "name": "2500/3500",
      "yearStart": 1981,
      "yearEnd": null,
      "bodyType": "пикап",
      "country": "США"
    }
  ],
  "Renault": [
    {
      "name": "Master",
      "yearStart": 1980,
      "yearEnd": null,
      "bodyType": "коммерческий фургон",
      "country": "Франция"
    },
    {
      "name": "Clio",
      "yearStart": 1990,
      "yearEnd": null,
      "bodyType": "компактный автомобиль",
      "country": "Франция"
    },
    {
      "name": "Megane",
      "yearStart": 1995,
      "yearEnd": null,
      "bodyType": "хэтчбек",
      "country": "Франция"
    },
    {
      "name": "Scenic",
      "yearStart": 1996,
      "yearEnd": null,
      "bodyType": "компактвэн",
      "country": "Франция"
    },
    {
      "name": "Duster",
      "yearStart": 2009,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Франция"
    },
    {
      "name": "Talisman (Laguna)",
      "yearStart": 2015,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Франция"
    }
  ],
  "Roewe": [
    {
      "name": "RX5",
      "yearStart": 2014,
      "yearEnd": null,
      "bodyType": "среднеразмерный внедорожник",
      "country": "Китай"
    },
    {
      "name": "i6",
      "yearStart": 2016,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Китай"
    }
  ],
  "Rolls-Royce": [
    {
      "name": "Phantom",
      "yearStart": 2003,
      "yearEnd": null,
      "bodyType": "представительский седан",
      "country": "Великобритания"
    },
    {
      "name": "Ghost",
      "yearStart": 2009,
      "yearEnd": null,
      "bodyType": "представительский седан",
      "country": "Великобритания"
    }
  ],
  "Saab": [
    {
      "name": "9-5",
      "yearStart": 1997,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Швеция"
    },
    {
      "name": "9-3",
      "yearStart": 1998,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Швеция"
    }
  ],
  "Seat": [
    {
      "name": "Ibiza",
      "yearStart": 1993,
      "yearEnd": null,
      "bodyType": "компактный автомобиль",
      "country": "Испания"
    },
    {
      "name": "Leon",
      "yearStart": 1999,
      "yearEnd": null,
      "bodyType": "хэтчбек",
      "country": "Испания"
    },
    {
      "name": "Ateca",
      "yearStart": 2016,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Испания"
    },
    {
      "name": "Arona",
      "yearStart": 2017,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Испания"
    },
    {
      "name": "Tarraco",
      "yearStart": 2018,
      "yearEnd": null,
      "bodyType": "полноразмерный внедорожник",
      "country": "Испания"
    }
  ],
  "Skoda": [
    {
      "name": "Octavia",
      "yearStart": 1996,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Чехия"
    },
    {
      "name": "Fabia",
      "yearStart": 1999,
      "yearEnd": null,
      "bodyType": "компактный автомобиль",
      "country": "Чехия"
    },
    {
      "name": "Superb",
      "yearStart": 2001,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Чехия"
    },
    {
      "name": "Roomster",
      "yearStart": 2006,
      "yearEnd": null,
      "bodyType": "компактвэн",
      "country": "Чехия"
    },
    {
      "name": "Yeti",
      "yearStart": 2009,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Чехия"
    },
    {
      "name": "Kodiaq",
      "yearStart": 2016,
      "yearEnd": null,
      "bodyType": "полноразмерный внедорожник",
      "country": "Чехия"
    },
    {
      "name": "Karoq",
      "yearStart": 2017,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Чехия"
    }
  ],
  "Smart": [
    {
      "name": "Fortwo",
      "yearStart": 1998,
      "yearEnd": null,
      "bodyType": "компактный автомобиль",
      "country": "Германия"
    },
    {
      "name": "Forfour",
      "yearStart": 2014,
      "yearEnd": null,
      "bodyType": "компактный автомобиль",
      "country": "Германия"
    },
    {
      "name": "EQ1 (#1)",
      "yearStart": 2018,
      "yearEnd": null,
      "bodyType": "компактный автомобиль",
      "country": "Германия"
    },
    {
      "name": "EQ3 (#3)",
      "yearStart": 2021,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Германия"
    }
  ],
  "SsangYong": [
    {
      "name": "Rexton",
      "yearStart": 2001,
      "yearEnd": null,
      "bodyType": "полноразмерный внедорожник",
      "country": "Южная Корея"
    },
    {
      "name": "Korando",
      "yearStart": 2011,
      "yearEnd": null,
      "bodyType": "среднеразмерный внедорожник",
      "country": "Южная Корея"
    },
    {
      "name": "Tivoli",
      "yearStart": 2015,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Южная Корея"
    }
  ],
  "Subaru": [
    {
      "name": "Legacy",
      "yearStart": 1989,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Япония"
    },
    {
      "name": "Impreza",
      "yearStart": 1992,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Япония"
    },
    {
      "name": "Outback",
      "yearStart": 1994,
      "yearEnd": null,
      "bodyType": "универсал",
      "country": "Япония"
    },
    {
      "name": "Forester",
      "yearStart": 1997,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Япония"
    },
    {
      "name": "BRZ",
      "yearStart": 2012,
      "yearEnd": null,
      "bodyType": "спортивный автомобиль",
      "country": "Япония"
    },
    {
      "name": "Crosstrek (XV)",
      "yearStart": 2012,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Япония"
    }
  ],
  "Suzuki": [
    {
      "name": "Jimny",
      "yearStart": 1970,
      "yearEnd": null,
      "bodyType": "внедорожник",
      "country": "Япония"
    },
    {
      "name": "Alto",
      "yearStart": 1979,
      "yearEnd": null,
      "bodyType": "компактный автомобиль",
      "country": "Япония"
    },
    {
      "name": "Grand Vitara",
      "yearStart": 1998,
      "yearEnd": null,
      "bodyType": "полноразмерный внедорожник",
      "country": "Япония"
    },
    {
      "name": "Swift",
      "yearStart": 2004,
      "yearEnd": null,
      "bodyType": "компактный автомобиль",
      "country": "Япония"
    },
    {
      "name": "SX4 S-Cross",
      "yearStart": 2013,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Япония"
    },
    {
      "name": "Vitara",
      "yearStart": 2015,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Япония"
    }
  ],
  "SWM (Taiga)": [
    {
      "name": "Condor",
      "yearStart": 2009,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Россия"
    }
  ],
  "Taiga (TagAZ)": [
    {
      "name": "Condor (Aquila)",
      "yearStart": 2009,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Россия"
    }
  ],
  "Toyota": [
    {
      "name": "Land Cruiser",
      "yearStart": 1960,
      "yearEnd": null,
      "bodyType": "полноразмерный внедорожник",
      "country": "Япония"
    },
    {
      "name": "Corolla",
      "yearStart": 1966,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Япония"
    },
    {
      "name": "Supra",
      "yearStart": 1978,
      "yearEnd": null,
      "bodyType": "спортивный автомобиль",
      "country": "Япония"
    },
    {
      "name": "Camry",
      "yearStart": 1982,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Япония"
    },
    {
      "name": "RAV4",
      "yearStart": 1994,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Япония"
    },
    {
      "name": "Prius",
      "yearStart": 1997,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Япония"
    },
    {
      "name": "Yaris",
      "yearStart": 1999,
      "yearEnd": null,
      "bodyType": "компактный автомобиль",
      "country": "Япония"
    },
    {
      "name": "Tundra",
      "yearStart": 2000,
      "yearEnd": null,
      "bodyType": "пикап",
      "country": "Япония"
    },
    {
      "name": "Highlander",
      "yearStart": 2001,
      "yearEnd": null,
      "bodyType": "полноразмерный внедорожник",
      "country": "Япония"
    },
    {
      "name": "C-HR",
      "yearStart": 2016,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Япония"
    }
  ],
  "TVR": [
    {
      "name": "Griffith",
      "yearStart": 1991,
      "yearEnd": null,
      "bodyType": "спортивный автомобиль",
      "country": "Великобритания"
    }
  ],
  "UAZ": [
    {
      "name": "469 (Hunter)",
      "yearStart": 1972,
      "yearEnd": null,
      "bodyType": "внедорожник",
      "country": "Россия"
    },
    {
      "name": "Hunter",
      "yearStart": 2003,
      "yearEnd": null,
      "bodyType": "внедорожник",
      "country": "Россия"
    },
    {
      "name": "Patriot",
      "yearStart": 2005,
      "yearEnd": null,
      "bodyType": "внедорожник",
      "country": "Россия"
    }
  ],
  "Ural": [
    {
      "name": "44202",
      "yearStart": 2003,
      "yearEnd": null,
      "bodyType": "грузовик",
      "country": "Россия"
    },
    {
      "name": "63095",
      "yearStart": 2010,
      "yearEnd": null,
      "bodyType": "грузовик",
      "country": "Россия"
    }
  ],
  "Volkswagen": [
    {
      "name": "Beetle",
      "yearStart": 1938,
      "yearEnd": null,
      "bodyType": "компактный автомобиль",
      "country": "Германия"
    },
    {
      "name": "Transporter",
      "yearStart": 1950,
      "yearEnd": null,
      "bodyType": "коммерческий фургон",
      "country": "Германия"
    },
    {
      "name": "Passat",
      "yearStart": 1973,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Германия"
    },
    {
      "name": "Golf",
      "yearStart": 1974,
      "yearEnd": null,
      "bodyType": "хэтчбек",
      "country": "Германия"
    },
    {
      "name": "Polo",
      "yearStart": 1975,
      "yearEnd": null,
      "bodyType": "компактный автомобиль",
      "country": "Германия"
    },
    {
      "name": "Jetta",
      "yearStart": 1980,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Германия"
    },
    {
      "name": "Caddy",
      "yearStart": 1982,
      "yearEnd": null,
      "bodyType": "легкий грузовик",
      "country": "Германия"
    },
    {
      "name": "Touareg",
      "yearStart": 2002,
      "yearEnd": null,
      "bodyType": "полноразмерный внедорожник",
      "country": "Германия"
    },
    {
      "name": "Tiguan",
      "yearStart": 2007,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Германия"
    },
    {
      "name": "T-Roc",
      "yearStart": 2017,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Германия"
    },
    {
      "name": "ID.3",
      "yearStart": 2020,
      "yearEnd": null,
      "bodyType": "хэтчбек",
      "country": "Германия"
    },
    {
      "name": "ID.4",
      "yearStart": 2020,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Германия"
    },
    {
      "name": "ID.Buzz",
      "yearStart": 2022,
      "yearEnd": null,
      "bodyType": "фургон",
      "country": "Германия"
    }
  ],
  "Volvo": [
    {
      "name": "S60",
      "yearStart": 2000,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Швеция"
    },
    {
      "name": "XC60",
      "yearStart": 2008,
      "yearEnd": null,
      "bodyType": "среднеразмерный внедорожник",
      "country": "Швеция"
    },
    {
      "name": "S90",
      "yearStart": 2016,
      "yearEnd": null,
      "bodyType": "представительский седан",
      "country": "Швеция"
    },
    {
      "name": "XC40",
      "yearStart": 2018,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Швеция"
    }
  ],
  "Voyah": [
    {
      "name": "Free",
      "yearStart": 2021,
      "yearEnd": null,
      "bodyType": "среднеразмерный внедорожник",
      "country": "Китай"
    }
  ],
  "Weltmeister": [
    {
      "name": "EX5",
      "yearStart": 2018,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Китай"
    }
  ],
  "XPeng": [
    {
      "name": "P7",
      "yearStart": 2020,
      "yearEnd": null,
      "bodyType": "седан",
      "country": "Китай"
    },
    {
      "name": "G9",
      "yearStart": 2021,
      "yearEnd": null,
      "bodyType": "среднеразмерный внедорожник",
      "country": "Китай"
    },
    {
      "name": "G6",
      "yearStart": 2022,
      "yearEnd": null,
      "bodyType": "компактный кроссовер",
      "country": "Китай"
    }
  ]
} satisfies Record<string, VehicleModel[]>;

export const VEHICLE_MAKES = Object.keys(VEHICLE_DATA).sort((a, b) => a.localeCompare(b));

export const CURRENT_YEAR = 2025;
