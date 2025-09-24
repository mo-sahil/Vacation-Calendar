package com.example.vacationcalendar;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/calendar")
public class CalendarController {

    private final CalendarService calendarService;

    public CalendarController(CalendarService calendarService) {
        this.calendarService = calendarService;
    }

    @GetMapping("/countries")
    public ResponseEntity<JsonNode> getCountries() {
        JsonNode countries = calendarService.getAvailableCountries();
        if (countries != null) {
            return ResponseEntity.ok(countries);
        }
        return ResponseEntity.internalServerError().build();
    }

    @GetMapping("/holidays")
    public ResponseEntity<JsonNode> getHolidays(
            @RequestParam int year,
            @RequestParam String country) {
        JsonNode holidays = calendarService.getHolidays(year, country);
        if (holidays != null) {
            return ResponseEntity.ok(holidays);
        }
        return ResponseEntity.internalServerError().build();
    }
}

