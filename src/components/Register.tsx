import React from "react";
import {Card, CardBody, Form, Input, Checkbox, Button} from "@heroui/react";

export default function Register() {
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [submitted, setSubmitted] = React.useState<Record<string, string> | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  // Real-time password validation
  const getPasswordError = (value: string) => {
    if (value.length < 4) {
      return "Password must be 4 characters or more";
    }
    if ((value.match(/[A-Z]/g) || []).length < 1) {
      return "Password needs at least 1 uppercase letter";
    }
    if ((value.match(/[^a-z]/gi) || []).length < 1) {
      return "Password needs at least 1 symbol";
    }

    return null;
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;

    // Custom validation checks
    const newErrors: Record<string, string> = {};

    // Password validation
    const passwordError = getPasswordError(data.password);
    if (passwordError) {
      newErrors.password = passwordError;
    }

    // Confirm password
    if (data.password !== data.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    // Username validation
    if (data.name === "admin") {
      newErrors.name = "Choose a different username";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (data.terms !== "true") {
      setErrors({terms: "Please accept the terms"});
      return;
    }

    setErrors({});
    setSubmitted(data);
  };

  const inputClassNames = {
    inputWrapper: "border-0 shadow-none bg-default-100",
  };

  return (
    <div className="flex justify-center items-center h-screen">
      <Card className="w-full max-w-xs rounded-xl text-xs">
        <CardBody className="p-3">
          <h1 className="text-center font-semibold mb-3">Registrarse</h1>
          <Form
            className="w-full justify-center items-center space-y-2"
            validationErrors={errors}
            onReset={() => setSubmitted(null)}
            onSubmit={onSubmit}
          >
            <div className="flex flex-col gap-2">
              <Input
                isRequired
                size="sm"
                variant="flat"
                radius="sm"
                classNames={inputClassNames}
                errorMessage={({validationDetails}) => {
                  if (validationDetails.valueMissing) {
                    return "Please enter your name";
                  }
                  return errors.name;
                }}
                label="Nombre"
                labelPlacement="outside"
                name="name"
                placeholder="Enter your name"
              />

              <Input
                isRequired
                size="sm"
                variant="flat"
                radius="sm"
                classNames={inputClassNames}
                errorMessage={({validationDetails}) => {
                  if (validationDetails.valueMissing) {
                    return "Please enter your email";
                  }
                  if (validationDetails.typeMismatch) {
                    return "Please enter a valid email";
                  }
                }}
                label="Correo electrónico"
                labelPlacement="outside"
                name="email"
                placeholder="Enter your email"
                type="email"
              />

              <Input
                isRequired
                size="sm"
                variant="flat"
                radius="sm"
                classNames={inputClassNames}
                errorMessage={getPasswordError(password)}
                isInvalid={getPasswordError(password) !== null}
                label="Contraseña"
                labelPlacement="outside"
                name="password"
                placeholder="Enter your password"
                type="password"
                value={password}
                onValueChange={setPassword}
              />

              <Input
                isRequired
                size="sm"
                variant="flat"
                radius="sm"
                classNames={inputClassNames}
                errorMessage={errors.confirmPassword}
                isInvalid={!!errors.confirmPassword}
                label="Confirmar contraseña"
                labelPlacement="outside"
                name="confirmPassword"
                placeholder="Confirm your password"
                type="password"
                value={confirmPassword}
                onValueChange={setConfirmPassword}
              />

              <Checkbox
                size="sm"
                isRequired
                classNames={{
                  label: "text-small",
                }}
                isInvalid={!!errors.terms}
                name="terms"
                validationBehavior="aria"
                value="true"
                onValueChange={() => setErrors((prev) => ({...prev, terms: undefined}))}
              >
                Acepto los términos y condiciones
              </Checkbox>

              {errors.terms && <span className="text-danger text-small">{errors.terms}</span>}

              <div className="flex gap-2">
                <Button className="w-full" size="sm" color="primary" radius="sm" type="submit">
                  Registrarse
                </Button>
              </div>
            </div>

            {submitted && (
              <div className="text-default-500 mt-2">
                Submitted data: <pre>{JSON.stringify(submitted, null, 2)}</pre>
              </div>
            )}
          </Form>
        </CardBody>
      </Card>
    </div>
  );
}
