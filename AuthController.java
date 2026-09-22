package com.nexusfiber.backend.controller;

import com.nexusfiber.backend.controller.dto.AuthRequest;
import com.nexusfiber.backend.controller.dto.AuthResponse;
import com.nexusfiber.backend.controller.dto.RegisterRequest;
import com.nexusfiber.backend.domain.User;
import com.nexusfiber.backend.exception.AuthenticationException;
import com.nexusfiber.backend.exception.DuplicateResourceException;
import com.nexusfiber.backend.repository.UserRepository;
import com.nexusfiber.backend.security.JwtUtil;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;
import java.time.ZonedDateTime;

/**
 * Handles authentication (login) and user registration.
 * Issues stateless JWT tokens upon successful authentication.
 */
@Slf4j
@RestController
@RequestMapping("/api")
public class AuthController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public AuthController(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtUtil jwtUtil) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
    }

    /**
     * Authenticates a user and returns a JWT access/refresh token pair.
     *
     * @param requestMono login credentials (username + password)
     * @return JWT tokens with role and username metadata
     */
    @PostMapping("/token/")
    public Mono<AuthResponse> login(@Valid @RequestBody Mono<AuthRequest> requestMono) {
        return requestMono.flatMap(request ->
                userRepository.findByUsername(request.getUsername())
                        .filter(user -> passwordEncoder.matches(request.getPassword(), user.getPasswordHash()))
                        .map(this::buildAuthResponse)
                        .switchIfEmpty(Mono.error(new AuthenticationException("Invalid credentials")))
                        .doOnSuccess(resp -> log.info("User '{}' authenticated successfully", request.getUsername()))
        );
    }

    /**
     * Registers a new user with the specified role and returns JWT tokens.
     *
     * @param requestMono registration data (username, password, role)
     * @return JWT tokens for the newly created user with HTTP 201
     */
    @PostMapping("/register/")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<AuthResponse> register(@Valid @RequestBody Mono<RegisterRequest> requestMono) {
        return requestMono.flatMap(request ->
                userRepository.findByUsername(request.getUsername())
                        .flatMap(existing -> Mono.<AuthResponse>error(
                                new DuplicateResourceException("Username '" + request.getUsername() + "' already exists")))
                        .switchIfEmpty(
                                Mono.defer(() -> {
                                    User newUser = User.builder()
                                            .username(request.getUsername())
                                            .passwordHash(passwordEncoder.encode(request.getPassword()))
                                            .role(request.getRole().name())
                                            .isActive(true)
                                            .dateJoined(ZonedDateTime.now())
                                            .build();

                                    return userRepository.save(newUser)
                                            .map(this::buildAuthResponse)
                                            .doOnSuccess(resp -> log.info("User '{}' registered with role '{}'",
                                                    newUser.getUsername(), newUser.getRole()));
                                })
                        )
        );
    }

    private AuthResponse buildAuthResponse(User user) {
        String token = jwtUtil.generateToken(user.getUsername(), user.getRole());
        return AuthResponse.builder()
                .access(token)
                .refresh(token)
                .role(user.getRole())
                .username(user.getUsername())
                .build();
    }
}
