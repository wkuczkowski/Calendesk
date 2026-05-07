document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("surveyForm");
    const cards = document.querySelectorAll(".card");
    let currentCard = 0;

    form.addEventListener("click", function (event) {
        if (event.target.classList.contains("next-btn")) {
            if (validateCard(currentCard)) {
                navigateToCard(currentCard + 1);
            }
        } else if (event.target.classList.contains("prev-btn")) {
            navigateToCard(currentCard - 1);
        }
    });

    form.addEventListener("submit", function (event) {
        if (currentCard < cards.length - 1) {
            event.preventDefault();
            if (validateCard(currentCard)) {
                navigateToCard(currentCard + 1);
            }
        } else {
            alert("Form submitted successfully!");
        }
    });

    function navigateToCard(cardIndex) {
        if (cardIndex >= 0 && cardIndex < cards.length) {
            cards[currentCard].classList.remove("active");
            cards[cardIndex].classList.add("active");
            currentCard = cardIndex;
        }
    }

    function validateCard(cardIndex) {
        const inputs = cards[cardIndex].querySelectorAll("input, textarea");
        for (const input of inputs) {
            if (!input.checkValidity()) {
                alert("Please fill out all required fields.");
                return false;
            }
        }
        return true;
    }

    cards[currentCard].classList.add("active");
});
