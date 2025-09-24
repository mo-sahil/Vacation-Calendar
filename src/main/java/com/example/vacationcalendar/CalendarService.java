package com.example.vacationcalendar;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class CalendarService {

    // Reading properties from application.properties
    @Value("${calendarific.api.key}")
    private String apiKey;

    @Value("${calendarific.api.baseUrl}")
    private String baseUrl;

    private final RestTemplate restTemplate = new RestTemplate();

    public JsonNode getAvailableCountries() {
        String url = baseUrl + "/countries?api_key=" + apiKey;
        try {
            return restTemplate.getForObject(url, JsonNode.class);
        } catch (Exception e) {
            // In a real app, you'd have more robust error handling
            System.err.println("Error fetching countries: " + e.getMessage());
            return null;
        }
    }

    public JsonNode getHolidays(int year, String countryCode) {
        String url = String.format("%s/holidays?api_key=%s&country=%s&year=%d",
                baseUrl, apiKey, countryCode, year);
        try {
            return restTemplate.getForObject(url, JsonNode.class);
        } catch (Exception e) {
            System.err.println("Error fetching holidays: " + e.getMessage());
            return null;
        }
    }
}
