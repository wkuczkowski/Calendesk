document.getElementById('contactForm').addEventListener('submit', function(event) {
    event.preventDefault(); // Zapobiega domyślnej akcji wysyłania formularza

    var name = document.getElementById('name').value;
    var email = document.getElementById('email').value;
    var message = document.getElementById('message').value;

    if(name && email && message) {
        console.log("Formularz zostanie wysłany");
        this.submit(); // Wysyła formularz jeśli wszystkie pola są wypełnione
    } else {
        console.log("Uzupełnij wszystkie pola");
    }
});

