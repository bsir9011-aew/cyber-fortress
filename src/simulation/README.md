# Symulacja

Miejsce na przyszłe czyste funkcje TypeScript: czas, dostęp, biznes i telemetrię.
W bootstrapie 0.2 silnik nie jest jeszcze zaimplementowany.

Moduł może korzystać z `domain`, ale nie z Reacta, DOM, komponentów UI ani API
przeglądarki. Czas i losowość będą przekazywane jawnie, aby zapewnić deterministyczne
testy w środowisku Node. Nie twórz pętli symulacji w komponentach Reacta.
