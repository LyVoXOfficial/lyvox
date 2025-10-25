import fs from "fs";
import path from "path";

const rawTable = `
Acura MDX 2001 полноразмерный
 внедорожник Япония
Acura NSX 1990 спортивный
 автомобиль Япония
Acura RDX 2006 компактный кроссовер Япония
Acura TLX 2004 седан Япония
Alfa Romeo Giulia 2015 седан Италия
Alfa Romeo Stelvio 2017 компактный кроссовер Италия
Aston Martin DB11 2016 спортивный
 автомобиль Великобритания
Aston Martin DBX 2019 полноразмерный
 внедорожник Великобритания
Audi A1 2010 компактный
 автомобиль Германия
Audi A3 1996 компактный
 автомобиль Германия
Audi A4 1994 седан Германия
Audi A5 2007 купе/седан Германия
Audi A6 1994 седан Германия
Audi A7 2010 седан Германия
Audi A8 1994 представительский
 седан Германия
Audi Q2 2016 компактный кроссовер Германия
Audi Q3 2011 компактный кроссовер Германия
Audi Q4 2021 компактный кроссовер Германия
Audi Q5 2008 среднеразмерный
 внедорожник Германия
Audi Q7 2005 полноразмерный
 внедорожник Германия
Audi Q8 2018 полноразмерный
 внедорожник Германия
Audi R8 2006 спортивный
 автомобиль Германия
Audi TT 1998 купе/родстер Германия
Audi e-tron (Q8 e
tron) 2018 полноразмерный
 внедорожник Германия
Audi e-tron GT 2021 спортивный
 автомобиль Германия
BMW 1 Series 2004 компактный
 автомобиль Германия
BMW 2 Series 2014 компактный
 автомобиль Германия
BMW 3 Series 1975 седан Германия
BMW 4 Series 2013 купе/седан Германия
BMW 5 Series 1972 седан Германия
BMW 6 Series 1976 купе/кабриолет Германия
BMW 7 Series 1977 представительский
 седан Германия
BMW 8 Series 1989 люксовое купе Германия
BMW X1 2009 компактный кроссовер Германия
BMW X2 2018 компактный кроссовер Германия
BMW X3 2003 среднеразмерный
 внедорожник Германия
BMW X4 2014 среднеразмерный
 внедорожник Германия
BMW X5 1999 полноразмерный
 внедорожник Германия
BMW X6 2008 полноразмерный
 внедорожник Германия
BMW X7 2019 полноразмерный
 внедорожник Германия
BMW Z4 2002 родстер Германия
BMW i3 2013 компактный
 автомобиль Германия
BMW i7 2021 представительский
 седан Германия
BMW i8 2014 спортивный
 автомобиль Германия
Bentley Bentayga 2015 полноразмерный
 внедорожник Великобритания
Bentley Continental 2003 представительский
 седан Великобритания
Bentley Flying Spur 2005 представительский
 седан Великобритания
Bugatti Chiron 2016 спортивный
 автомобиль Франция
BYD Atto 3 2021 компактный кроссовер Китай
BYD DM-i 2020 седан Китай
BYD Qin 2010 седан Китай
BYD Seagull 2023 компактный
 автомобиль Китай
BYD Song MAX DM-i 2021 минивэн Китай
BYD Song DM-i
 Sedan 2020 седан Китай
BYD Yuan Plus 2021 компактный кроссовер Китай
BYD Song 2008 внедорожник Китай
Cadillac Escalade 2002 полноразмерный
 внедорожник США
Caterham Seven 1973 спортивный
 автомобиль Великобритания
Changan CS35 2012 компактный кроссовер Китай
Changan CS75 2014 среднеразмерный
 внедорожник Китай
Changan Eado 2015 седан Китай
Chery QQ 2003 компактный
 автомобиль Китай
Chery Tiggo 2006 компактный кроссовер Китай
Chevrolet Camaro 1966 спортивный
 автомобиль США
Chevrolet Corvette 1953 спортивный
 автомобиль США
Chevrolet Equinox 2004 компактный кроссовер США
Chevrolet Malibu 1964 седан США
Chrysler 300 2004 седан США
Chrysler Crossfire 2003 спортивный
 автомобиль США
Chrysler PT Cruiser 2000 компактный
 автомобиль США
Chrysler Pacifica 2016 минивэн США
Citroen C1 2005 компактный
 автомобиль Франция
Citroen C3 2002 компактный
 автомобиль Франция
Citroen C4 2004 хэтчбек Франция
Citroen C5 2000 седан Франция
Cupra Formentor 2020 компактный кроссовер Испания
Cupra Leon (Cupra
 Leon) 2020 хэтчбек Испания
Cupra Ateca (Cupra
 Ateca) 2018 компактный кроссовер Испания
DS DS3 2010 компактный
 автомобиль Франция
DS DS4 2011 компактный
 автомобиль Франция
DS DS7 2017 среднеразмерный
 внедорожник Франция
Dacia Duster 2009 компактный кроссовер Румыния
Dacia Logan 2004 седан Румыния
Dacia Sandero 2007 хэтчбек Румыния
Dodge Challenger 1970 спортивный
 автомобиль США
Dodge Charger 1966 седан США
Dodge Durango 1998 среднеразмерный
 внедорожник США
Dodge Grand Caravan 1984 минивэн США
Dodge Journey 2008 компактный кроссовер США
Dodge Viper 1992 спортивный
 автомобиль США
Dongfeng H30 2014 хэтчбек Китай
Dongfeng T5 2017 компактный кроссовер Китай
FAW Besturn B50 2012 седан Китай
FAW Besturn X40 2016 компактный кроссовер Китай
Ferrari F8 Tributo 2019 спортивный
 автомобиль Италия
Ferrari SF90 Stradale 2019 спортивный
 автомобиль Италия
Fiat 500 2007 компактный
 автомобиль Италия
Fiat Panda 1980 компактный
 автомобиль Италия
Fiat Punto 1993 компактный
 автомобиль Италия
Ford Explorer 2020 среднеразмерный
 внедорожник США
Ford F-150 1948 пикап США
Ford Fiesta 1976 компактный
 автомобиль США
Ford Focus 1998 хэтчбек США
Ford Kuga 2008 компактный кроссовер США
Ford Mondeo 1993 седан США
Ford Mustang 1964 спортивный
 автомобиль США
Ford Transit 1965 коммерческий фургон США
Ford Transit Custom 2012 коммерческий фургон США
GAZ Gazelle 1994 легкий грузовик Россия
GAZ Sobol 1998 фургон Россия
Geely Boyue 2016 среднеразмерный
 внедорожник Китай
Geely Coolray 2018 компактный кроссовер Китай
Geely Emgrand 2009 седан Китай
Geely GS 2015 внедорожник Китай
Genesis G70 2017 седан Южная Корея
Genesis G80 2016 седан Южная Корея
Genesis G90 2015 представительский
 седан Южная Корея
Genesis GV70 2020 компактный кроссовер Южная Корея
Genesis GV80 2020 среднеразмерный
 внедорожник Южная Корея
Great Wall Haval H6 2011 компактный кроссовер Китай
Great Wall Haval H9 2014 полноразмерный
 внедорожник Китай
Great Wall Wingle 2009 пикап Китай
Haval F7 2018 среднеразмерный
 внедорожник Китай
Haval F7X 2019 купе/седан Китай
Honda Accord 1976 седан Япония
Honda Civic 1972 седан Япония
Honda CR-V 1996 компактный кроссовер Япония
Honda Fit (Jazz) 2001 компактный
 автомобиль Япония
Honda Pilot 2002 полноразмерный
 внедорожник Япония
Huanghai N2 2012 внедорожник Китай
Huanghai Utes 2015 пикап Китай
Hyundai Elantra 1990 седан Южная Корея
Hyundai Kona 2017 компактный кроссовер Южная Корея
Hyundai Palisade 2018 полноразмерный
 внедорожник Южная Корея
Hyundai Santa Fe 2000 среднеразмерный
 внедорожник Южная Корея
Hyundai Sonata 1985 седан Южная Корея
Hyundai Tucson 2004 компактный кроссовер Южная Корея
Infiniti Q50 2013 седан Япония
Infiniti Q60 2013 спортивный
 автомобиль Япония
Infiniti QX50 2013 компактный кроссовер Япония
Infiniti QX60 2013 полноразмерный
 внедорожник Япония
Infiniti QX80 2013 полноразмерный
 внедорожник Япония
Isuzu D-Max 2002 пикап Япония
Isuzu MU-X 2013 полноразмерный
 внедорожник Япония
JAC S2 2018 компактный кроссовер Китай
JAC T6 2014 пикап Китай
Jaguar E-Pace 2017 компактный кроссовер Великобритания
Jaguar F-Pace 2016 среднеразмерный
 внедорожник Великобритания
Jaguar F-Type 2013 спортивный
 автомобиль Великобритания
Jaguar I-Pace 2018 компактный кроссовер Великобритания
Jaguar XE 2015 седан Великобритания
Jaguar XF 2008 седан Великобритания
Jaguar XJ 1968 представительский
 седан Великобритания
Kamaz 4308 1999 грузовик Россия
Kamaz 6520 2005 грузовик Россия
Kia Forte (Cerato) 2009 седан Южная Корея
Kia Niro 2016 компактный кроссовер Южная Корея
Kia Optima 2000 седан Южная Корея
Kia Rio 1999 компактный
 автомобиль Южная Корея
Kia Sorento 2002 среднеразмерный
 внедорожник Южная Корея
Kia Soul 2009 субкомпактный
 кроссовер Южная Корея
Kia Seltos 2019 компактный кроссовер Южная Корея
Kia Sportage 1995 компактный кроссовер Южная Корея
Kia Telluride 2019 полноразмерный
 внедорожник Южная Корея
Koenigsegg Agera 2011 спортивный
 автомобиль Швеция
Lada Granta 2011 седан Россия
Lada Largus 2012 фургон Россия
Lada Niva 1977 внедорожник Россия
Lada Priora 2007 седан Россия
Lada Vesta 2015 седан Россия
Land Rover Defender 1983 внедорожник Великобритания
Land Rover Discovery 1989 полноразмерный
 внедорожник Великобритания
Land Rover Range Rover 1970 полноразмерный
 внедорожник Великобритания
Land Rover Range Rover
 Evoque 2011 компактный кроссовер Великобритания
Land Rover Range Rover
 Sport 2005 среднеразмерный
 внедорожник Великобритания
Lexus ES 1989 седан Япония
Lexus GX 2002 среднеразмерный
 внедорожник Япония
Lexus IS 1999 седан Япония
Lexus LS 1989 представительский
 седан Япония
Lexus LX 1996 полноразмерный
 внедорожник Япония
Lexus NX 2014 компактный кроссовер Япония
Lexus RX 1998 среднеразмерный
 внедорожник Япония
Li Auto Li MEGA 2023 полноразмерный
 внедорожник Китай
Li Auto Li ONE 2019 полноразмерный
 внедорожник Китай
Lifan 520 2007 седан Китай
Lifan X60 2012 компактный кроссовер Китай
Lotus Eletre 2022 полноразмерный
 внедорожник Великобритания
Lotus Emira 2021 спортивный
 автомобиль Великобритания
MG HS 2018 среднеразмерный
 внедорожник Великобритания
MG MG3 2011 компактный
 автомобиль Великобритания
MG MG5 2021 компактный
 автомобиль Великобритания
MG MG6 2010 седан Великобритания
MG ZS 2017 компактный кроссовер Великобритания
Maserati Ghibli 2013 седан Италия
Maserati GranTurismo 2007 спортивный
 автомобиль Италия
Maserati Levante 2016 среднеразмерный
 внедорожник Италия
Maserati MC20 2020 спортивный
 автомобиль Италия
Maserati Quattroporte 1963 представительский
 седан Италия
Maybach S580 2021 представительский
 седан Германия
Mazda CX-3 2015 компактный кроссовер Япония
Mazda CX-30 2019 компактный кроссовер Япония
Mazda CX-5 2013 среднеразмерный
 внедорожник Япония
Mazda CX-9 2006 полноразмерный
 внедорожник Япония
Mazda Mazda2 2002 компактный
 автомобиль Япония
Mazda Mazda3 2003 седан Япония
Mazda Mazda6 2002 седан Япония
Mazda MX-5 (Miata) 1989 родстер Япония
McLaren 570S 2015 спортивный
 автомобиль Великобритания
McLaren GT 2019 спортивный
 автомобиль Великобритания
Mercedes
Benz A-Class 1997 компактный
 автомобиль Германия
Mercedes
Benz B-Class 2005 компактвэн Германия
Mercedes
Benz C-Class 1993 седан Германия
Mercedes
Benz CLA 2013 седан Германия
Mercedes
Benz CLS 2004 седан Германия
Mercedes
Benz E-Class 1984 седан Германия
Mercedes
Benz G-Class 1979 внедорожник Германия
Mercedes
Benz GLA 2013 компактный кроссовер Германия
Mercedes
Benz GLB 2019 компактный кроссовер Германия
Mercedes
Benz GLC 2015 среднеразмерный
 внедорожник Германия
Mercedes
Benz GLE 2015 полноразмерный
 внедорожник Германия
Mercedes
Benz GLS 2019 полноразмерный
 внедорожник Германия
Mercedes
Benz S-Class 1954 представительский
 седан Германия
Mercedes
Benz Sprinter 1995 коммерческий фургон Германия
Mercedes
Benz Vito 1996 коммерческий фургон Германия
Mini Clubman 2007 универсал Великобритания
Mini Countryman 2010 компактный кроссовер Великобритания
Mini Hatch (Cooper) 2001 хэтчбек Великобритания
Mitsubishi ASX (Outlander
 Sport) 2010 компактный кроссовер Япония
Mitsubishi Eclipse Cross 2017 компактный кроссовер Япония
Mitsubishi Lancer 1973 седан Япония
Mitsubishi Mirage 1978 компактный
 автомобиль Япония
Mitsubishi Outlander 2003 среднеразмерный
 внедорожник Япония
Mitsubishi Pajero
 (Montero) 1982 полноразмерный
 внедорожник Япония
Morgan 4/4 1936 родстер Великобритания
Morgan Plus Six 2019 спортивный
 автомобиль Великобритания
Moskvitch 2141 (Aleko) 1986 седан Россия
Moskvitch 3 1994 седан Россия
NIO ES6 2018 среднеразмерный
 внедорожник Китай
NIO ES8 2018 полноразмерный
 внедорожник Китай
NIO ET6 2023 седан Китай
Nissan Altima (Teana) 1992 седан Япония
Nissan GT-R 2007 спортивный
 автомобиль Япония
Nissan Leaf 2010 седан Япония
Nissan Maxima 1981 седан Япония
Nissan Navara
 (Frontier) 1997 пикап Япония
Nissan Pathfinder 1986 полноразмерный
 внедорожник Япония
Nissan Qashqai 2006 компактный кроссовер Япония
Nissan Rogue (X-Trail) 2007 компактный кроссовер Япония
Opel Astra 1991 хэтчбек Германия
Opel Corsa 1982 компактный
 автомобиль Германия
Opel Grandland 2017 среднеразмерный
 внедорожник Германия
Opel Insignia 2008 седан Германия
Opel Crossland 2017 компактный кроссовер Германия
Opel Mokka 2012 компактный кроссовер Германия
Opel Vectra 1988 седан Германия
Opel Zafira 1999 минивэн Германия
Pagani Huayra 2011 спортивный
 автомобиль Италия
Peugeot 208 2012 компактный
 автомобиль Франция
Peugeot 3008 2009 среднеразмерный
 внедорожник Франция
Peugeot 308 2013 хэтчбек Франция
Peugeot 5008 2009 полноразмерный
 внедорожник Франция
Peugeot Boxer 1994 коммерческий фургон Франция
Peugeot 508 2011 седан Франция
Polestar 1 2021 седан Швеция
Polestar 2 2019 седан Швеция
Polestar 3 2023 среднеразмерный
 внедорожник Швеция
Porsche 911 1963 спортивный
 автомобиль Германия
Porsche Cayenne 2002 полноразмерный
 внедорожник Германия
Porsche Panamera 2009 представительский
 седан Германия
Porsche Taycan 2019 спортивный
 автомобиль Германия
Ram 1500 1981 пикап США
Ram 2500/3500 1981 пикап США
Renault Clio 1990 компактный
 автомобиль Франция
Renault Duster 2009 компактный кроссовер Франция
Renault Master 1980 коммерческий фургон Франция
Renault Megane 1995 хэтчбек Франция
Renault Scenic 1996 компактвэн Франция
Renault Talisman
 (Laguna) 2015 седан Франция
Roewe RX5 2014 среднеразмерный
 внедорожник Китай
Roewe i6 2016 седан Китай
Rolls-Royce Ghost 2009 представительский
 седан Великобритания
Rolls-Royce Phantom 2003 представительский
 седан Великобритания
SWM (Taiga) Condor 2009 седан Россия
Saab 9-3 1998 седан Швеция
Saab 9-5 1997 седан Швеция
Seat Arona 2017 компактный кроссовер Испания
Seat Ibiza 1993 компактный
 автомобиль Испания
Seat Leon 1999 хэтчбек Испания
Seat Tarraco 2018 полноразмерный
 внедорожник Испания
Seat Ateca 2016 компактный кроссовер Испания
Skoda Fabia 1999 компактный
 автомобиль Чехия
Skoda Karoq 2017 компактный кроссовер Чехия
Skoda Kodiaq 2016 полноразмерный
 внедорожник Чехия
Skoda Octavia 1996 седан Чехия
Skoda Roomster 2006 компактвэн Чехия
Skoda Superb 2001 седан Чехия
Skoda Yeti 2009 компактный кроссовер Чехия
Smart EQ1 (#1) 2018 компактный
 автомобиль Германия
Smart EQ3 (#3) 2021 компактный кроссовер Германия
Smart Forfour 2014 компактный
 автомобиль Германия
Smart Fortwo 1998 компактный
 автомобиль Германия
SsangYong Korando 2011 среднеразмерный
 внедорожник Южная Корея
SsangYong Tivoli 2015 компактный кроссовер Южная Корея
SsangYong Rexton 2001 полноразмерный
 внедорожник Южная Корея
Subaru BRZ 2012 спортивный
 автомобиль Япония
Subaru Crosstrek (XV) 2012 компактный кроссовер Япония
Subaru Forester 1997 компактный кроссовер Япония
Subaru Impreza 1992 седан Япония
Subaru Legacy 1989 седан Япония
Subaru Outback 1994 универсал Япония
Suzuki Alto 1979 компактный
 автомобиль Япония
Suzuki Grand Vitara 1998 полноразмерный
 внедорожник Япония
Suzuki Jimny 1970 внедорожник Япония
Suzuki Swift 2004 компактный
 автомобиль Япония
Suzuki SX4 S-Cross 2013 компактный кроссовер Япония
Suzuki Vitara 2015 компактный кроссовер Япония
TVR Griffith 1991 спортивный
 автомобиль Великобритания
Taiga
 (TagAZ) Condor (Aquila) 2009 седан Россия
Toyota Camry 1982 седан Япония
Toyota Corolla 1966 седан Япония
Toyota C-HR 2016 компактный кроссовер Япония
Toyota Highlander 2001 полноразмерный
 внедорожник Япония
Toyota Land Cruiser 1960 полноразмерный
 внедорожник Япония
Toyota Prius 1997 седан Япония
Toyota RAV4 1994 компактный кроссовер Япония
Toyota Supra 1978 спортивный
 автомобиль Япония
Toyota Tundra 2000 пикап Япония
Toyota Yaris 1999 компактный
 автомобиль Япония
UAZ 469 (Hunter) 1972 внедорожник Россия
UAZ Hunter 2003 внедорожник Россия
UAZ Patriot 2005 внедорожник Россия
Ural 44202 2003 грузовик Россия
Ural 63095 2010 грузовик Россия
Volkswagen Beetle 1938 компактный
 автомобиль Германия
Volkswagen Caddy 1982 легкий грузовик Германия
Volkswagen Golf 1974 хэтчбек Германия
Volkswagen ID.3 2020 хэтчбек Германия
Volkswagen ID.4 2020 компактный кроссовер Германия
Volkswagen ID.Buzz 2022 фургон Германия
Volkswagen Jetta 1980 седан Германия
Volkswagen Passat 1973 седан Германия
Volkswagen Polo 1975 компактный
 автомобиль Германия
Volkswagen Tiguan 2007 компактный кроссовер Германия
Volkswagen Touareg 2002 полноразмерный
 внедорожник Германия
Volkswagen T-Roc 2017 компактный кроссовер Германия
Volkswagen Transporter 1950 коммерческий фургон Германия
Volvo S60 2000 седан Швеция
Volvo S90 2016 представительский
 седан Швеция
Volvo XC40 2018 компактный кроссовер Швеция
Volvo XC60 2008 среднеразмерный
 внедорожник Швеция
Voyah Free 2021 среднеразмерный
 внедорожник Китай
Weltmeister EX5 2018 компактный кроссовер Китай
XPeng G6 2022 компактный кроссовер Китай
XPeng G9 2021 среднеразмерный
 внедорожник Китай
XPeng P7 2020 седан Китай
`;

const brandMap = [
  { patterns: ["Aston Martin"], canonical: "Aston Martin" },
  { patterns: ["Alfa Romeo"], canonical: "Alfa Romeo" },
  { patterns: ["Audi"], canonical: "Audi" },
  { patterns: ["Acura"], canonical: "Acura" },
  { patterns: ["Bentley"], canonical: "Bentley" },
  { patterns: ["BMW"], canonical: "BMW" },
  { patterns: ["Bugatti"], canonical: "Bugatti" },
  { patterns: ["BYD"], canonical: "BYD" },
  { patterns: ["Cadillac"], canonical: "Cadillac" },
  { patterns: ["Caterham"], canonical: "Caterham" },
  { patterns: ["Changan"], canonical: "Changan" },
  { patterns: ["Chery"], canonical: "Chery" },
  { patterns: ["Chevrolet"], canonical: "Chevrolet" },
  { patterns: ["Chrysler"], canonical: "Chrysler" },
  { patterns: ["Citroen"], canonical: "Citroen" },
  { patterns: ["Cupra"], canonical: "Cupra" },
  { patterns: ["DS"], canonical: "DS" },
  { patterns: ["Dacia"], canonical: "Dacia" },
  { patterns: ["Dodge"], canonical: "Dodge" },
  { patterns: ["Dongfeng"], canonical: "Dongfeng" },
  { patterns: ["FAW"], canonical: "FAW" },
  { patterns: ["Ferrari"], canonical: "Ferrari" },
  { patterns: ["Fiat"], canonical: "Fiat" },
  { patterns: ["Ford"], canonical: "Ford" },
  { patterns: ["GAZ"], canonical: "GAZ" },
  { patterns: ["Geely"], canonical: "Geely" },
  { patterns: ["Genesis"], canonical: "Genesis" },
  { patterns: ["Great Wall"], canonical: "Great Wall" },
  { patterns: ["Haval"], canonical: "Haval" },
  { patterns: ["Honda"], canonical: "Honda" },
  { patterns: ["Huanghai"], canonical: "Huanghai" },
  { patterns: ["Hyundai"], canonical: "Hyundai" },
  { patterns: ["Infiniti"], canonical: "Infiniti" },
  { patterns: ["Isuzu"], canonical: "Isuzu" },
  { patterns: ["JAC"], canonical: "JAC" },
  { patterns: ["Jaguar"], canonical: "Jaguar" },
  { patterns: ["Kamaz"], canonical: "Kamaz" },
  { patterns: ["Kia"], canonical: "Kia" },
  { patterns: ["Koenigsegg"], canonical: "Koenigsegg" },
  { patterns: ["Lada"], canonical: "Lada" },
  { patterns: ["Land Rover"], canonical: "Land Rover" },
  { patterns: ["Lexus"], canonical: "Lexus" },
  { patterns: ["Li Auto"], canonical: "Li Auto" },
  { patterns: ["Lifan"], canonical: "Lifan" },
  { patterns: ["Lotus"], canonical: "Lotus" },
  { patterns: ["MG"], canonical: "MG" },
  { patterns: ["Maserati"], canonical: "Maserati" },
  { patterns: ["Maybach"], canonical: "Maybach" },
  { patterns: ["Mazda"], canonical: "Mazda" },
  { patterns: ["McLaren"], canonical: "McLaren" },
  { patterns: ["Mercedes Benz", "Mercedes-Benz", "Mercedes"], canonical: "Mercedes-Benz" },
  { patterns: ["Mini"], canonical: "Mini" },
  { patterns: ["Mitsubishi"], canonical: "Mitsubishi" },
  { patterns: ["Morgan"], canonical: "Morgan" },
  { patterns: ["Moskvitch"], canonical: "Moskvitch" },
  { patterns: ["NIO"], canonical: "NIO" },
  { patterns: ["Nissan"], canonical: "Nissan" },
  { patterns: ["Opel"], canonical: "Opel" },
  { patterns: ["Pagani"], canonical: "Pagani" },
  { patterns: ["Peugeot"], canonical: "Peugeot" },
  { patterns: ["Polestar"], canonical: "Polestar" },
  { patterns: ["Porsche"], canonical: "Porsche" },
  { patterns: ["Ram"], canonical: "Ram" },
  { patterns: ["Renault"], canonical: "Renault" },
  { patterns: ["Roewe"], canonical: "Roewe" },
  { patterns: ["Rolls-Royce"], canonical: "Rolls-Royce" },
  { patterns: ["SWM (Taiga)"], canonical: "SWM (Taiga)" },
  { patterns: ["Saab"], canonical: "Saab" },
  { patterns: ["Seat"], canonical: "Seat" },
  { patterns: ["Skoda"], canonical: "Skoda" },
  { patterns: ["Smart"], canonical: "Smart" },
  { patterns: ["SsangYong"], canonical: "SsangYong" },
  { patterns: ["Subaru"], canonical: "Subaru" },
  { patterns: ["Suzuki"], canonical: "Suzuki" },
  { patterns: ["TVR"], canonical: "TVR" },
  { patterns: ["Taiga (TagAZ)", "Taiga"], canonical: "Taiga (TagAZ)" },
  { patterns: ["Toyota"], canonical: "Toyota" },
  { patterns: ["UAZ"], canonical: "UAZ" },
  { patterns: ["Ural"], canonical: "Ural" },
  { patterns: ["Volkswagen"], canonical: "Volkswagen" },
  { patterns: ["Volvo"], canonical: "Volvo" },
  { patterns: ["Voyah"], canonical: "Voyah" },
  { patterns: ["Weltmeister"], canonical: "Weltmeister" },
  { patterns: ["XPeng"], canonical: "XPeng" },
];

const brandPatterns = brandMap
  .flatMap(({ patterns, canonical }) => patterns.map((pattern) => ({ pattern, canonical })))
  .sort((a, b) => b.pattern.length - a.pattern.length);

const raw = rawTable.replace(/\r/g, "").replace(/\uFEFF/g, "");

const skipPatterns = [/^Марка/, /^Примечание/, /^Источники/, /^\d+(?:\s+\d+)*$/];

const tokens = raw
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean)
  .filter((line) => !skipPatterns.some((pattern) => pattern.test(line)));

const hasYear = (value) => /\b(19|20)\d{2}\b/.test(value);
const startsWithBrand = (value) => brandPatterns.some(({ pattern }) => value.startsWith(pattern));

const candidates = [];
let current = "";

for (const token of tokens) {
  const normalized = token.replace(/\s+/g, " ").trim();
  const tokenHasYear = hasYear(normalized);
  const currentHasYear = hasYear(current);
  const tokenStartsBrand = startsWithBrand(normalized);

  if (tokenHasYear) {
    if (currentHasYear) {
      candidates.push(current.trim());
      current = normalized;
    } else if (current) {
      current = `${current} ${normalized}`;
    } else {
      current = normalized;
    }
    continue;
  }

  if (tokenStartsBrand && currentHasYear) {
    candidates.push(current.trim());
    current = normalized;
    continue;
  }

  current = current ? `${current} ${normalized}` : normalized;
}

if (hasYear(current)) {
  candidates.push(current.trim());
}

const countries = [
  "Южная Корея",
  "Великобритания",
  "Италия",
  "Германия",
  "Китай",
  "США",
  "Франция",
  "Испания",
  "Румыния",
  "Россия",
  "Швеция",
  "Чехия",
  "Япония",
];

const uniqueCountries = [...new Set(countries)];
uniqueCountries.sort((a, b) => b.length - a.length);

function parseLine(line) {
  const brandEntry = brandPatterns.find(({ pattern }) => line === pattern || line.startsWith(`${pattern} `));
  if (!brandEntry) {
    throw new Error(`Unknown brand prefix for line: ${line}`);
  }

  const brand = brandEntry.canonical;
  const rest = line.slice(brandEntry.pattern.length).trim();
  const yearMatch = rest.match(/\b(19|20)\d{2}\b/);
  if (!yearMatch) {
    throw new Error(`Missing year in line: ${line}`);
  }

  const yearIndex = rest.indexOf(yearMatch[0]);
  const model = rest.slice(0, yearIndex).trim();
  const afterYear = rest.slice(yearIndex + yearMatch[0].length).trim();

  const country = uniqueCountries.find((entry) => afterYear.endsWith(entry));
  if (!country) {
    throw new Error(`Unable to detect country in line: ${line}`);
  }

  const bodyType = afterYear.slice(0, -country.length).trim();

  return {
    make: brand,
    model: model.replace(/\s+/g, " "),
    yearStart: Number(yearMatch[0]),
    bodyType: bodyType.replace(/\s+/g, " "),
    country,
  };
}

const entries = candidates.map(parseLine);

const dedupKey = (item) => `${item.make}||${item.model}`;
const deduped = new Map();
for (const entry of entries) {
  deduped.set(dedupKey(entry), entry);
}

const dataset = Array.from(deduped.values()).sort((a, b) => {
  const makeCompare = a.make.localeCompare(b.make);
  if (makeCompare !== 0) return makeCompare;
  return a.model.localeCompare(b.model);
});

const csvLines = [
  "Make,Model,Year_Start,Year_End,Body_Type,Country",
  ...dataset.map((item) =>
    [
      item.make.includes(",") ? `"${item.make.replace(/"/g, '""')}"` : item.make,
      item.model.includes(",") || item.model.includes('"')
        ? `"${item.model.replace(/"/g, '""')}"` : item.model,
      item.yearStart,
      "",
      item.bodyType.includes(",") || item.bodyType.includes('"')
        ? `"${item.bodyType.replace(/"/g, '""')}"` : item.bodyType,
      item.country,
    ].join(","),
  ),
];

const csvPath = path.resolve("seed", "transport_make_model.csv");
fs.writeFileSync(csvPath, `${csvLines.join("\n")}\n`, "utf8");
console.log(`Updated CSV at ${csvPath} with ${dataset.length} records.`);

const grouped = dataset.reduce((acc, item) => {
  if (!acc[item.make]) {
    acc[item.make] = [];
  }
  acc[item.make].push({
    name: item.model,
    yearStart: item.yearStart,
    yearEnd: null,
    bodyType: item.bodyType,
    country: item.country,
  });
  return acc;
}, {});

for (const make of Object.keys(grouped)) {
  grouped[make].sort((a, b) => {
    if (a.yearStart !== b.yearStart) return a.yearStart - b.yearStart;
    return a.name.localeCompare(b.name);
  });
}

const tsPath = path.resolve("apps", "web", "src", "data", "vehicles.ts");
fs.mkdirSync(path.dirname(tsPath), { recursive: true });

const currentYear = new Date().getFullYear();
const tsContent = `export type VehicleModel = {
  name: string;
  yearStart: number;
  yearEnd: number | null;
  bodyType: string;
  country: string;
};

export const VEHICLE_DATA = ${JSON.stringify(grouped, null, 2)} satisfies Record<string, VehicleModel[]>;

export const VEHICLE_MAKES = Object.keys(VEHICLE_DATA).sort((a, b) => a.localeCompare(b));

export const CURRENT_YEAR = ${currentYear};
`;

fs.writeFileSync(tsPath, tsContent, "utf8");
console.log(`Generated vehicle dataset module at ${tsPath}.`);
